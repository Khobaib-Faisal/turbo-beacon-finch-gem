/**
 * PrepWiser chapter PDF text parser (text-first MVP).
 * Input: plain text from pdf-parse / pdftotext.
 * Does not attempt OCR or diagram crops — stores page refs and flags uncertain items.
 */

import type { SubjectId } from "@/lib/jee/types";
import type { ExtractedQuestion, ExtractResult, PyqQuestionType } from "./types";

const CHAPTER_SUBJECT_HINTS: Array<{ re: RegExp; subject: SubjectId }> = [
  { re: /physics|kinematics|electrostatics|optics|mechanics/i, subject: "physics" },
  { re: /chemistry|organic|inorganic|mole concept|bonding/i, subject: "chemistry" },
  {
    re: /math|matrix|determinant|calculus|integral|differenti|vector|probability|trigonometry|parabola|ellipse|hyperbola|circle|straight line|sequence|binomial|permutation|complex|limit|continuity|statistics|set/i,
    subject: "maths",
  },
];

function normalizeSpace(s: string): string {
  return s.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Map letter answer to 0-based index for MCQ display. */
export function letterToIndex(letter: string): number | null {
  const c = letter.trim().toUpperCase();
  if (c === "A") return 0;
  if (c === "B") return 1;
  if (c === "C") return 2;
  if (c === "D") return 3;
  return null;
}

/** Parse numeric/letter correct answer into the number shape used by the vault UI. */
export function correctAnswerToNumber(
  type: PyqQuestionType,
  raw: string | null,
): number {
  if (raw == null || raw === "") return 0;
  if (type === "mcq") {
    const idx = letterToIndex(raw);
    if (idx != null) return idx;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(String(raw).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function detectChapter(text: string, fileName: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < Math.min(lines.length, 30); i += 1) {
    const line = lines[i];
    if (/chapter-wise|previous year|answer key|pyqs|papers|topics|attempt each|stuck on|practise this/i.test(line)) continue;
    if (/prepwiser/i.test(line)) continue;
    if (/jee\s*main/i.test(line)) continue;
    const spaces = (line.match(/ /g) || []).length;
    if (line.length > 8 && spaces / line.length > 0.3) continue;
    if (/^[·•\-|]+$/.test(line)) continue;
    if (/^\d+$/.test(line)) continue;
    if (line.length >= 3 && line.length < 90) {
      return line.replace(/\s+/g, " ");
    }
  }
  const fromFile = fileName
    .replace(/^PrepWiser_/i, "")
    .replace(/_JEE-Main-PYQs\.pdf$/i, "")
    .replace(/_/g, " ")
    .trim();
  return fromFile || "Unknown Chapter";
}

function detectSubject(chapter: string, text: string, explicit?: SubjectId): SubjectId {
  if (explicit) return explicit;
  const blob = `${chapter}\n${text.slice(0, 2000)}`;
  for (const h of CHAPTER_SUBJECT_HINTS) {
    if (h.re.test(blob)) return h.subject;
  }
  return "maths";
}

function buildPageOffsets(text: string): Array<{ offset: number; page: number }> {
  const pages: Array<{ offset: number; page: number }> = [{ offset: 0, page: 1 }];
  const re = /\f/g;
  let m: RegExpExecArray | null;
  let page = 2;
  while ((m = re.exec(text))) {
    pages.push({ offset: m.index, page });
    page += 1;
  }
  const footer = /(\d+)\s*\/\s*\d+/g;
  while ((m = footer.exec(text))) {
    const p = Number(m[1]);
    if (p > 1 && Number.isFinite(p)) {
      pages.push({ offset: m.index, page: p });
    }
  }
  pages.sort((a, b) => a.offset - b.offset);
  return pages;
}

function pageAt(pages: Array<{ offset: number; page: number }>, offset: number): number {
  let page = 1;
  for (const p of pages) {
    if (p.offset <= offset) page = p.page;
    else break;
  }
  return page;
}

function parseAnswerKey(text: string): Record<string, string> {
  const key: Record<string, string> = {};
  const idx = text.search(/Answer\s*key\s*:/i);
  if (idx < 0) return key;
  const section = text.slice(idx, idx + 8000);
  const re = /(\d+)\s*[\.\)]\s*([A-D]|-?\d+(?:\.\d+)?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(section))) {
    key[m[1]] = m[2].toUpperCase();
  }
  return key;
}

type Block = {
  num: number;
  start: number;
  end: number;
  header: string;
  body: string;
  topic: string | null;
};

function splitQuestionBlocks(text: string): { blocks: Block[]; topics: Map<number, string> } {
  const topicHits: Array<{ offset: number; topic: string }> = [];
  const topicRe = /^([A-Za-z][A-Za-z0-9\s&\-,()]+?)\s*[·•|]\s*\d+\s*PYQs?\s*$/gim;
  let tm: RegExpExecArray | null;
  while ((tm = topicRe.exec(text))) {
    topicHits.push({ offset: tm.index, topic: tm[1].trim() });
  }

  const qRe = /\bQ(\d+)\s+JEE\s+Main[^\n]*/gi;
  const starts: Array<{ num: number; index: number; header: string }> = [];
  let qm: RegExpExecArray | null;
  while ((qm = qRe.exec(text))) {
    starts.push({ num: Number(qm[1]), index: qm.index, header: qm[0] });
  }

  if (starts.length === 0) {
    const alt = /\bQ(\d+)\b/gi;
    while ((qm = alt.exec(text))) {
      starts.push({ num: Number(qm[1]), index: qm.index, header: qm[0] });
    }
  }

  starts.sort((a, b) => a.index - b.index);
  const blocks: Block[] = [];
  for (let i = 0; i < starts.length; i += 1) {
    const cur = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1].index : text.search(/Answer\s*key\s*:/i);
    const endPos = end > cur.index ? end : text.length;
    let topic: string | null = null;
    for (const t of topicHits) {
      if (t.offset < cur.index) topic = t.topic;
    }
    blocks.push({
      num: cur.num,
      start: cur.index,
      end: endPos,
      header: cur.header,
      body: text.slice(cur.index, endPos),
      topic,
    });
  }
  const topics = new Map<number, string>();
  for (const b of blocks) if (b.topic) topics.set(b.num, b.topic);
  return { blocks, topics };
}

function parseOptions(body: string): string[] | null {
  const opts: string[] = [];
  const re = /\(([A-D])\)\s*([^\n]*?)(?=\s*\([A-D]\)|$)/gi;
  let m: RegExpExecArray | null;
  const found = new Map<string, string>();
  while ((m = re.exec(body))) {
    found.set(m[1].toUpperCase(), normalizeSpace(m[2]));
  }
  if (found.size >= 2) {
    for (const letter of ["A", "B", "C", "D"]) {
      opts.push(found.get(letter) ?? "");
    }
    return opts;
  }
  return null;
}

function isNumerical(header: string, body: string): boolean {
  if (/NUMERICAL/i.test(header) || /NUMERICAL/i.test(body.slice(0, 200))) return true;
  if (/_{4,}|\bblank\b|is equal to\s*_/i.test(body) && !/\([A-D]\)/.test(body)) return true;
  return false;
}

function stripHeaderNoise(body: string): string {
  return body
    .replace(/\bQ\d+\s+JEE\s+Main[^\n]*/gi, "")
    .replace(/Step-by-step solution[^\n]*/gi, "")
    .replace(/prepwiser\.in\/questions\/\S+/gi, "")
    .replace(/\bNUMERICAL\b/gi, "")
    .replace(/PrepWiser[^\n]*/gi, "")
    .trim();
}

function extractQuestionText(body: string, hasOptions: boolean): string {
  let t = stripHeaderNoise(body);
  if (hasOptions) {
    const firstOpt = t.search(/\([A-D]\)/);
    if (firstOpt > 0) t = t.slice(0, firstOpt);
  }
  t = t.replace(/_{5,}.*$/m, "").trim();
  return normalizeSpace(t).slice(0, 8000);
}

export function parsePrepWiserText(
  rawText: string,
  opts: {
    fileName: string;
    subject?: SubjectId;
  },
): ExtractResult {
  const text = rawText.replace(/\r\n/g, "\n");
  const warnings: string[] = [];
  const chapter = detectChapter(text, opts.fileName);
  const subject = detectSubject(chapter, text, opts.subject);
  const answerKey = parseAnswerKey(text);
  if (Object.keys(answerKey).length === 0) {
    warnings.push("No answer key section detected — answers left empty.");
  }

  const pages = buildPageOffsets(text);
  const { blocks } = splitQuestionBlocks(text);
  if (blocks.length === 0) {
    warnings.push("No questions matched (expected Qn + JEE Main markers).");
  }

  const questions: ExtractedQuestion[] = [];
  const seenNums = new Set<number>();

  for (const block of blocks) {
    if (seenNums.has(block.num)) continue;
    seenNums.add(block.num);

    const numerical = isNumerical(block.header, block.body);
    const options = numerical ? null : parseOptions(block.body);
    const questionText = extractQuestionText(block.body, Boolean(options));
    const flags: string[] = [];
    let needsReview = false;

    if (!questionText || questionText.length < 8) {
      flags.push("short_or_empty_text");
      needsReview = true;
    }
    if (!numerical && (!options || options.filter((o) => o).length < 2)) {
      flags.push("options_incomplete");
      needsReview = true;
    }
    if (/[∫∑√∞]/.test(block.body) || (block.body.match(/[αβθπ]/g) || []).length > 3) {
      flags.push("math_heavy_check_page");
    }
    if (!options && !numerical) {
      flags.push("type_uncertain");
      needsReview = true;
    }

    const sourceMatch = block.header.match(/JEE\s+Main[^\n]*/i);
    const source = sourceMatch
      ? normalizeSpace(sourceMatch[0]).replace(/Step-by-step.*/i, "").trim()
      : "JEE Main";

    const ans = answerKey[String(block.num)] ?? null;
    if (!ans) {
      flags.push("missing_answer_key");
      needsReview = true;
    }

    const pageNumber = pageAt(pages, block.start);
    const externalKey = [
      subject,
      chapter.toLowerCase().replace(/\s+/g, "-"),
      `q${block.num}`,
      simpleHash(source + "|" + questionText.slice(0, 120)),
    ].join("|");

    questions.push({
      externalKey,
      questionNumber: block.num,
      source,
      type: options && options.filter(Boolean).length >= 2 ? "mcq" : "integer",
      questionText: questionText || `[See page ${pageNumber} — extraction incomplete]`,
      options: options && options.some(Boolean) ? options : null,
      correctAnswer: ans,
      topic: block.topic,
      pageNumber,
      needsReview,
      flags,
    });
  }

  questions.sort((a, b) => (a.questionNumber ?? 0) - (b.questionNumber ?? 0));

  return {
    chapter,
    subject,
    sourcePdf: opts.fileName,
    questions,
    answerKey,
    warnings,
  };
}

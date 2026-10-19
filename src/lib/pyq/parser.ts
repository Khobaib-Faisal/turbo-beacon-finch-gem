/**
 * PrepWiser chapter PDF text parser (text-first).
 * Tolerates both pdftotext layout and pdf.js extracted text.
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
  return s
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Stable chapter slug for external keys (re-import updates same row). */
export function chapterSlug(chapter: string): string {
  return chapter
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function letterToIndex(letter: string): number | null {
  const c = letter.trim().toUpperCase();
  if (c === "A") return 0;
  if (c === "B") return 1;
  if (c === "C") return 2;
  if (c === "D") return 3;
  return null;
}

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
  // PrepWiser filenames are authoritative — never use page markers like "1/3"
  const fromFile = fileName
    .replace(/^[0-9a-f-]{8,}_/i, "") // strip uuid prefixes from mobile uploads
    .replace(/^PrepWiser_/i, "")
    .replace(/_JEE-Main-PYQs\.pdf$/i, "")
    .replace(/\.pdf$/i, "")
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .trim();
  if (fromFile && /[A-Za-z]{3,}/.test(fromFile)) {
    return fromFile.replace(/\s+/g, " ");
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < Math.min(lines.length, 40); i += 1) {
    const line = lines[i];
    if (
      /chapter-wise|previous year|answer key|pyqs|papers|topics|attempt each|stuck on|practise this/i.test(
        line,
      )
    ) {
      continue;
    }
    if (/prepwiser/i.test(line)) continue;
    if (/jee\s*main/i.test(line)) continue;
    if (/^\d+\s*\/\s*\d+$/.test(line)) continue;
    if (/^\d+$/.test(line)) continue;
    const spaces = (line.match(/ /g) || []).length;
    if (line.length > 8 && spaces / line.length > 0.3) continue;
    if (/^[·•\-|]+$/.test(line)) continue;
    if (line.length >= 3 && line.length < 90 && /[A-Za-z]{3,}/.test(line)) {
      return line.replace(/\s+/g, " ");
    }
  }
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
  const section = text.slice(idx, idx + 12000);
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

const Q_HEADER_RE = /\bQ(\d+)\s+JEE\s+Main\b/gi;

function splitQuestionBlocks(text: string): { blocks: Block[]; topics: Map<number, string> } {
  const topicHits: Array<{ offset: number; topic: string }> = [];
  const topicRe =
    /([A-Za-z][A-Za-z0-9\s&\-,()]{2,60}?)\s*[·•|]\s*\d+\s*PYQs?\b/gi;
  let tm: RegExpExecArray | null;
  while ((tm = topicRe.exec(text))) {
    topicHits.push({ offset: tm.index, topic: tm[1].trim() });
  }

  const starts: Array<{ num: number; index: number; header: string }> = [];
  let qm: RegExpExecArray | null;
  Q_HEADER_RE.lastIndex = 0;
  while ((qm = Q_HEADER_RE.exec(text))) {
    const header = text.slice(qm.index, Math.min(text.length, qm.index + 160)).split(/\n/)[0];
    starts.push({ num: Number(qm[1]), index: qm.index, header });
  }

  if (starts.length === 0) {
    const alt = /(?:^|\n)\s*Q(\d+)\b/gi;
    while ((qm = alt.exec(text))) {
      starts.push({
        num: Number(qm[1]),
        index: qm.index,
        header: text.slice(qm.index, qm.index + 40),
      });
    }
  }

  starts.sort((a, b) => a.index - b.index);
  const answerIdx = text.search(/Answer\s*key\s*:/i);
  const blocks: Block[] = [];
  for (let i = 0; i < starts.length; i += 1) {
    const cur = starts[i];
    let end =
      i + 1 < starts.length
        ? starts[i + 1].index
        : answerIdx > cur.index
          ? answerIdx
          : text.length;
    if (end <= cur.index) end = text.length;
    let topic: string | null = null;
    for (const t of topicHits) {
      if (t.offset < cur.index) topic = t.topic;
    }
    blocks.push({
      num: cur.num,
      start: cur.index,
      end,
      header: cur.header,
      body: text.slice(cur.index, end),
      topic,
    });
  }
  const topics = new Map<number, string>();
  for (const b of blocks) if (b.topic) topics.set(b.num, b.topic);
  return { blocks, topics };
}

function parseOptions(body: string): string[] | null {
  const found = new Map<string, string>();
  const re = /\(([A-D])\)\s*([^]*?)(?=\s*\([A-D]\)|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const letter = m[1].toUpperCase();
    let val = normalizeSpace(m[2]);
    if (val.length > 400) val = val.slice(0, 400);
    found.set(letter, val);
  }
  if (found.size >= 2) {
    return ["A", "B", "C", "D"].map((L) => found.get(L) ?? "");
  }
  return null;
}

function isNumerical(header: string, body: string): boolean {
  if (/NUMERICAL/i.test(header) || /NUMERICAL/i.test(body.slice(0, 280))) return true;
  if (/_{4,}|\bblank\b|is equal to\s*_/i.test(body) && !/\([A-D]\)/.test(body)) return true;
  return false;
}

function stripHeaderNoise(body: string): string {
  let t = body;
  t = t.replace(
    /\bQ\d+\s+JEE\s+Main\s+\d{4}\s*[·•.\-]\s*\d{1,2}\s+[A-Za-z]+\s*[·•.\-]\s*Shift\s+\d+/gi,
    " ",
  );
  t = t.replace(/\bQ\d+\s+JEE\s+Main\b/gi, " ");
  t = t.replace(/\bNUMERICAL\b/gi, " ");
  t = t.replace(/Step-by-step solution\s*›?\s*/gi, " ");
  t = t.replace(/prepwiser\.in\/questions\/\S+/gi, " ");
  t = t.replace(/PrepWiser[^\n]{0,100}/gi, " ");
  t = t.replace(/Free JEE Main PYQs[^\n]{0,100}/gi, " ");
  t = t.replace(/\b\d+\s*\/\s*\d+\b/g, " ");
  t = t.replace(/^\s*\d{4}\s*[·•.\-]\s*\d{1,2}\s+[A-Za-z]+\s*[·•.\-]\s*Shift\s+\d+/i, " ");
  return t.trim();
}

function extractQuestionText(body: string, hasOptions: boolean): string {
  let t = stripHeaderNoise(body);
  if (hasOptions) {
    const firstOpt = t.search(/\([A-D]\)/);
    if (firstOpt >= 40) t = t.slice(0, firstOpt);
  }
  t = t.replace(/_{5,}.*$/m, "").trim();
  t = t.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return t.slice(0, 8000);
}

export function isPlaceholderText(s: string): boolean {
  return /extraction incomplete|see page\s+\d+/i.test(s) && s.length < 80;
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
    let questionText = extractQuestionText(block.body, Boolean(options));
    const flags: string[] = [];
    let needsReview = false;

    if (!questionText || questionText.length < 12) {
      const fallback = normalizeSpace(
        block.body.slice(0, 2000).replace(/\bQ\d+\s+JEE\s+Main\b/i, "").slice(0, 1500),
      );
      if (fallback.length >= 12) {
        questionText = fallback;
        flags.push("used_body_fallback");
        needsReview = true;
      }
    }

    if (!questionText || questionText.length < 12) {
      flags.push("short_or_empty_text");
      needsReview = true;
      questionText = "";
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

    const sourceMatch = block.header.match(/JEE\s+Main[^.\n]{0,80}/i);
    const source = sourceMatch
      ? normalizeSpace(sourceMatch[0]).replace(/Step-by-step.*/i, "").trim()
      : "JEE Main";

    const ans = answerKey[String(block.num)] ?? null;
    if (!ans) {
      flags.push("missing_answer_key");
      needsReview = true;
    }

    let qType: PyqQuestionType =
      options && options.filter(Boolean).length >= 2 ? "mcq" : "integer";
    if (ans && /^[A-D]$/i.test(ans)) {
      qType = "mcq";
      if (!options || options.filter(Boolean).length < 2) {
        flags.push("options_incomplete");
        needsReview = true;
      }
    } else if (ans && /^-?\d/.test(ans)) {
      qType = "integer";
    }

    const pageNumber = pageAt(pages, block.start);
    const externalKey = `${subject}|${chapterSlug(chapter)}|q${block.num}`;

    const displayText = questionText.length >= 12 ? questionText : "";

    const alpha = (displayText.match(/[A-Za-z]/g) || []).length;
    if (displayText && alpha < 20) {
      flags.push("low_text_quality");
      needsReview = true;
    }

    questions.push({
      externalKey,
      questionNumber: block.num,
      source,
      type: qType,
      questionText: displayText,
      options: qType === "mcq" ? (options && options.some(Boolean) ? options : null) : null,
      correctAnswer: ans,
      topic: block.topic,
      pageNumber,
      needsReview: needsReview || displayText.length < 12,
      flags:
        displayText.length < 12
          ? [...flags, "extraction_failed"]
          : flags,
    });
  }

  questions.sort((a, b) => (a.questionNumber ?? 0) - (b.questionNumber ?? 0));

  const failed = questions.filter((q) => q.flags.includes("extraction_failed")).length;
  if (failed > 0) {
    warnings.push(
      `${failed} question(s) had empty/short stems after extraction — flagged for manual review (not filled with fake text).`,
    );
  }

  return {
    chapter,
    subject,
    sourcePdf: opts.fileName,
    questions,
    answerKey,
    warnings,
  };
}

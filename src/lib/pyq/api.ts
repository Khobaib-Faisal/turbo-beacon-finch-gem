import { createServerFn } from "@tanstack/react-start";
import { createMiddleware } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { requireAdmin } from "@/lib/pyq/admin";
import { parsePrepWiserText, correctAnswerToNumber } from "@/lib/pyq/parser";
import type { ChapterBundle, ExtractResult, ImportQuestionInput } from "@/lib/pyq/types";
import type { SubjectId } from "@/lib/jee/types";

const SUBJECTS: SubjectId[] = ["physics", "chemistry", "maths"];

function isSubject(v: string): v is SubjectId {
  return SUBJECTS.includes(v as SubjectId);
}

const adminMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("@/lib/auth/client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
    assertSameSiteRequest();
    const admin = await requireAdmin(context.bearerToken);
    return next({ context: { userId: admin.userId, adminEmail: admin.email } });
  });

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const { isAdminEmail } = await import("@/lib/pyq/admin");
    const user = await getSessionUser();
    return { isAdmin: isAdminEmail(user?.email ?? null) };
  });

export const extractPyqFromText = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((input: { text: string; fileName: string; subject?: SubjectId }) => {
    if (!input || typeof input.text !== "string" || input.text.length < 20) {
      throw new Error("Paste or extract PDF text first.");
    }
    if (input.text.length > 2_500_000) throw new Error("Text too large.");
    if (typeof input.fileName !== "string" || !input.fileName.trim()) {
      throw new Error("Missing file name.");
    }
    const subject = input.subject && isSubject(input.subject) ? input.subject : undefined;
    return { text: input.text, fileName: input.fileName.trim().slice(0, 200), subject };
  })
  .handler(async ({ data }): Promise<ExtractResult> => {
    return parsePrepWiserText(data.text, { fileName: data.fileName, subject: data.subject });
  });

export const importPyqQuestions = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((input: { questions: ImportQuestionInput[] }) => {
    if (!input?.questions || !Array.isArray(input.questions)) throw new Error("No questions to import.");
    if (input.questions.length === 0) throw new Error("No questions to import.");
    if (input.questions.length > 500) throw new Error("Max 500 questions per batch.");
    return {
      questions: input.questions.map((q) => {
        if (!q.externalKey || !q.chapter || !q.questionText) {
          throw new Error("Each question needs externalKey, chapter, and text.");
        }
        if (!isSubject(q.subject)) throw new Error("Invalid subject.");
        if (q.type !== "mcq" && q.type !== "integer") throw new Error("Invalid type.");
        return q;
      }),
    };
  })
  .handler(async ({ data }) => {
    const sql = await getSql();
    let inserted = 0;
    let skipped = 0;
    for (const q of data.questions) {
      const id = crypto.randomUUID();
      const optionsJson = q.options ? JSON.stringify(q.options) : null;
      const rows = await sql.query<{ id: string }>(
        `insert into pyq_questions (
          id, subject, chapter, topic, source, question_number, type,
          question_text, options, correct_answer, explanation,
          answer_verified, needs_review, page_number, source_pdf, external_key
        ) values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16
        )
        on conflict (external_key) do nothing
        returning id`,
        [
          id, q.subject, q.chapter, q.topic, q.source, q.questionNumber, q.type,
          q.questionText, optionsJson, q.correctAnswer, "", false,
          Boolean(q.needsReview), q.pageNumber, q.sourcePdf, q.externalKey,
        ],
      );
      if (rows[0]) inserted += 1;
      else skipped += 1;
    }
    return { inserted, skipped, total: data.questions.length };
  });

export const listPyqChapters = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { subject: SubjectId } | undefined) => {
    const subject = input?.subject;
    if (!subject || !isSubject(subject)) throw new Error("Pick a subject.");
    return { subject };
  })
  .handler(async ({ data }): Promise<ChapterBundle[]> => {
    const sql = await getSql();
    const rows = await sql<{
      id: string; subject: string; chapter: string; source: string; type: string;
      question_text: string; options: unknown; correct_answer: string | null;
      explanation: string; page_number: number | null; needs_review: boolean;
      answer_verified: boolean;
    }>`
      select id, subject, chapter, source, type, question_text, options,
             correct_answer, explanation, page_number, needs_review, answer_verified
      from pyq_questions
      where subject = ${data.subject}
      order by chapter asc, question_number asc nulls last, created_at asc
    `;

    const byChapter = new Map<string, ChapterBundle>();
    for (const row of rows) {
      let bundle = byChapter.get(row.chapter);
      if (!bundle) {
        bundle = { chapter: row.chapter, subject: data.subject, questions: [] };
        byChapter.set(row.chapter, bundle);
      }
      let options: string[] | undefined;
      if (row.options) {
        if (typeof row.options === "string") {
          try { options = JSON.parse(row.options); } catch { options = undefined; }
        } else if (Array.isArray(row.options)) {
          options = row.options as string[];
        }
      }
      const type = row.type === "mcq" ? "mcq" : "integer";
      bundle.questions.push({
        id: row.id,
        source: row.source,
        type,
        question: row.question_text,
        options,
        correctAnswer: correctAnswerToNumber(type, row.correct_answer),
        explanation:
          row.explanation ||
          (row.answer_verified ? "" : "Answer key imported but not verified yet."),
        pageNumber: row.page_number,
        needsReview: Boolean(row.needs_review),
        answerVerified: Boolean(row.answer_verified),
      });
    }
    return [...byChapter.values()];
  });

export const getPyqImportStats = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const rows = await sql<{ subject: string; n: number }>`
      select subject, count(*)::int as n from pyq_questions group by subject
    `;
    const total = await sql<{ n: number }>`select count(*)::int as n from pyq_questions`;
    return {
      total: total[0]?.n ?? 0,
      bySubject: Object.fromEntries(rows.map((r) => [r.subject, r.n])),
    };
  });

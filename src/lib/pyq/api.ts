import { createServerFn } from "@tanstack/react-start";
import { createMiddleware } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { requireAdmin } from "@/lib/pyq/admin";
import { parsePrepWiserText, correctAnswerToNumber } from "@/lib/pyq/parser";
import {
  pyqImageKeyFromExternalKey,
  pyqImageObjectKey,
  storePyqImage,
} from "@/lib/pyq/object-storage.server";
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

/** Insert or update by external_key. Never sets answer_verified=true. */
export const importPyqQuestions = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((input: { questions: ImportQuestionInput[]; mode?: "insert" | "upsert" }) => {
    if (!input?.questions || !Array.isArray(input.questions)) throw new Error("No questions to import.");
    if (input.questions.length === 0) throw new Error("No questions to import.");
    if (input.questions.length > 500) throw new Error("Max 500 questions per batch.");
    const mode = input.mode === "insert" ? "insert" : "upsert";
    return {
      mode,
      questions: input.questions.map((q) => {
        if (!q.externalKey || !q.chapter) {
          throw new Error("Each question needs externalKey and chapter.");
        }
        if (typeof q.questionText !== "string") {
          throw new Error("questionText must be a string.");
        }
        if (q.questionImageUrl != null) {
          if (
            typeof q.questionImageUrl !== "string" ||
            !q.questionImageUrl.startsWith("data:image/jpeg;base64,") ||
            q.questionImageUrl.length > 300_000
          ) {
            throw new Error("Question image must be a JPEG crop under 300 KB.");
          }
        }
        if (!q.questionText.trim() && !q.needsReview) {
          throw new Error("Empty question text must be marked needsReview.");
        }
        if (!isSubject(q.subject)) throw new Error("Invalid subject.");
        if (q.year != null && (!Number.isInteger(q.year) || q.year < 2000 || q.year > 2035)) {
          throw new Error("Year must be a valid exam year.");
        }
        if (q.type !== "mcq" && q.type !== "integer") throw new Error("Invalid type.");
        return q;
      }),
    };
  })
  .handler(async ({ data }) => {
    const sql = await getSql();
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    for (const q of data.questions) {
      const id = crypto.randomUUID();
      const optionsJson = q.options ? JSON.stringify(q.options) : null;
      const imageUrl = q.questionImageUrl
        ? await storePyqImage(
            pyqImageKeyFromExternalKey(q.externalKey),
            q.questionImageUrl,
          )
        : null;
      if (data.mode === "insert") {
        const rows = await sql.query<{ id: string }>(
          `insert into pyq_questions (
            id, subject, chapter, topic, source, question_number, type,
            question_text, options, correct_answer, explanation,
            answer_verified, needs_review, page_number, source_pdf, external_key,
            question_image_url, year
          ) values (
            $1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,$18
          )
          on conflict (external_key) do nothing
          returning id`,
          [
            id, q.subject, q.chapter, q.topic, q.source, q.questionNumber, q.type,
            q.questionText, optionsJson, q.correctAnswer, "", false,
            Boolean(q.needsReview), q.pageNumber, q.sourcePdf, q.externalKey,
            imageUrl, q.year,
          ],
        );
        if (rows[0]) inserted += 1;
        else skipped += 1;
      } else {
        const rows = await sql.query<{ id: string; is_insert: boolean }>(
          `insert into pyq_questions (
            id, subject, chapter, topic, source, question_number, type,
            question_text, options, correct_answer, explanation,
            answer_verified, needs_review, page_number, source_pdf, external_key,
            question_image_url, year
          ) values (
            $1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,$18
          )
          on conflict (external_key) do update set
            subject = excluded.subject,
            chapter = excluded.chapter,
            topic = excluded.topic,
            source = excluded.source,
            question_number = excluded.question_number,
            type = excluded.type,
            question_text = excluded.question_text,
            options = excluded.options,
            correct_answer = case
              when pyq_questions.answer_verified then pyq_questions.correct_answer
              else excluded.correct_answer
            end,
            needs_review = excluded.needs_review,
            page_number = excluded.page_number,
            source_pdf = excluded.source_pdf,
            question_image_url = coalesce(excluded.question_image_url, pyq_questions.question_image_url),
            year = coalesce(excluded.year, pyq_questions.year),
            updated_at = now()
          returning id, (xmax = 0) as is_insert`,
          [
            id, q.subject, q.chapter, q.topic, q.source, q.questionNumber, q.type,
            q.questionText, optionsJson, q.correctAnswer, "", false,
            Boolean(q.needsReview), q.pageNumber, q.sourcePdf, q.externalKey,
            imageUrl, q.year,
          ],
        );
        if (rows[0]) {
          if (rows[0].is_insert) inserted += 1;
          else updated += 1;
        } else {
          skipped += 1;
        }
      }
    }
    return { inserted, updated, skipped, total: data.questions.length, mode: data.mode };
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
      question_image_url: string | null;
      year: number | null;
    }>`
      select id, subject, chapter, source, type, question_text, options,
             correct_answer, explanation, page_number, needs_review, answer_verified,
             question_image_url, year
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
      const stem = row.question_text || "";
      const isEmpty = !stem.trim();
      bundle.questions.push({
        id: row.id,
        source: row.source,
        year: row.year,
        type,
        question: isEmpty
          ? `[Extraction incomplete — see PDF page ${row.page_number ?? "?"}]`
          : stem,
        options,
        visualQuestion: Boolean(row.question_image_url),
        hasVisualImage: Boolean(row.question_image_url),
        correctAnswer: correctAnswerToNumber(type, row.correct_answer),
        explanation:
          row.explanation ||
          (row.answer_verified
            ? ""
            : "Answer key imported but not verified yet."),
        pageNumber: row.page_number,
        needsReview: Boolean(row.needs_review) || isEmpty,
        answerVerified: Boolean(row.answer_verified),
        answerAvailable: row.correct_answer !== null && row.correct_answer.trim() !== "",
      });
    }
    return [...byChapter.values()];
  });

/** Return this signed-in user's saved PYQ solve history. */
export const listSolvedPyqQuestionIds = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<string[]> => {
    const sql = await getSql();
    const rows = await sql<{ question_id: string }>`
      select question_id
      from pyq_solved_questions
      where user_id = ${context.userId}
    `;
    return rows.map((row) => row.question_id);
  });

/** Save solved question ids for the signed-in user; existing solves are retained. */
export const saveSolvedPyqQuestionIds = createServerFn({ method: "POST" })
  .validator((input: { ids: string[] }) => {
    if (!input || !Array.isArray(input.ids) || input.ids.length > 20_000) {
      throw new Error("Invalid solved question list.");
    }
    const ids = [...new Set(input.ids.map((id) => {
      if (typeof id !== "string" || !id.trim() || id.length > 200) {
        throw new Error("A solved question id is invalid.");
      }
      return id.trim();
    }))];
    return { ids };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    if (data.ids.length === 0) return { saved: 0 };
    const sql = await getSql();
    const rows = await sql.query<{ question_id: string }>(
      `insert into pyq_solved_questions (user_id, question_id)
       select $1, unnest($2::text[])
       on conflict (user_id, question_id) do nothing
       returning question_id`,
      [context.userId, data.ids],
    );
    return { saved: rows.length };
  });

/** Load a visual question on demand so an entire chapter of image data isn't sent at once. */
export const getPyqQuestionImage = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { id: string } | undefined) => {
    const id = input?.id?.trim();
    if (!id || id.length > 100) throw new Error("Choose a question.");
    return { id };
  })
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<{ question_image_url: string | null }>`
      select question_image_url from pyq_questions where id = ${data.id} limit 1
    `;
    return { imageUrl: rows[0]?.question_image_url ?? null };
  });

/** Move existing inline image data out of Postgres in small admin-only batches. */
export const migratePyqImagesToObjectStorage = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const rows = await sql<{ id: string; question_image_url: string }>`
      select id, question_image_url
      from pyq_questions
      where question_image_url like 'data:image/jpeg;base64,%'
      order by created_at, id
      limit 5
    `;
    let moved = 0;
    for (const row of rows) {
      const imageUrl = await storePyqImage(
        pyqImageObjectKey(row.id),
        row.question_image_url,
      );
      const result = await sql.query<{ id: string }>(
        `update pyq_questions set question_image_url = $2, updated_at = now()
         where id = $1 and question_image_url = $3 returning id`,
        [row.id, imageUrl, row.question_image_url],
      );
      moved += result.length;
    }
    // A five-image batch limits temporary growth; vacuum once per batch to
    // reuse the replaced inline image space without the cost of vacuuming each row.
    await sql.query("VACUUM (ANALYZE) pyq_questions");
    const remaining = await sql<{ n: number }>`
      select count(*)::int as n from pyq_questions
      where question_image_url like 'data:image/jpeg;base64,%'
    `;
    return { moved, remaining: remaining[0]?.n ?? 0 };
  });

export const getPyqImportStats = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const rows = await sql<{ subject: string; n: number }>`
      select subject, count(*)::int as n from pyq_questions group by subject
    `;
    const total = await sql<{ n: number }>`select count(*)::int as n from pyq_questions`;
    const bad = await sql<{ n: number }>`
      select count(*)::int as n from pyq_questions
      where question_text = '' or question_text is null
         or question_text ilike '%extraction incomplete%'
         or question_text ilike '%see page%'
    `;
    return {
      total: total[0]?.n ?? 0,
      bySubject: Object.fromEntries(rows.map((r) => [r.subject, r.n])),
      needsRepair: bad[0]?.n ?? 0,
    };
  });

/** List distinct chapters in DB for admin cleanup. */
export const listPyqDbChapters = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const rows = await sql<{
      subject: string;
      chapter: string;
      n: number;
      junk: number;
    }>`
      select subject, chapter, count(*)::int as n,
        count(*) filter (
          where question_text = '' or question_text is null
             or length(trim(question_text)) < 20
             or question_text ilike '%extraction incomplete%'
             or question_text ilike '%see page%'
        )::int as junk
      from pyq_questions
      group by subject, chapter
      order by subject, chapter
    `;
    return rows;
  });

/** Delete an entire chapter's imported questions (admin only). */
export const deletePyqChapter = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((input: { subject: SubjectId; chapter: string }) => {
    if (!input?.chapter || !isSubject(input.subject)) throw new Error("Need subject and chapter.");
    return { subject: input.subject, chapter: input.chapter.trim().slice(0, 200) };
  })
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ id: string }>(
      `delete from pyq_questions where subject = $1 and chapter = $2 returning id`,
      [data.subject, data.chapter],
    );
    return { deleted: rows.length, chapter: data.chapter, subject: data.subject };
  });

/** Move a chapter's questions to a shared chapter name (admin only). */
export const movePyqChapter = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((input: { subject: SubjectId; chapter: string; targetChapter: string }) => {
    if (!input?.chapter || !input.targetChapter?.trim() || !isSubject(input.subject)) {
      throw new Error("Choose the source and destination chapter.");
    }
    return {
      subject: input.subject,
      chapter: input.chapter.trim().slice(0, 200),
      targetChapter: input.targetChapter.trim().slice(0, 200),
    };
  })
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ id: string }>(
      `update pyq_questions set chapter = $3, updated_at = now()
       where subject = $1 and chapter = $2 returning id`,
      [data.subject, data.chapter, data.targetChapter],
    );
    return { moved: rows.length, from: data.chapter, to: data.targetChapter, subject: data.subject };
  });

/** Remove unreadable / junk rows and bogus chapter names like "1/3". */
export const deletePyqJunk = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const rows = await sql.query<{ id: string }>(
      `delete from pyq_questions
       where question_text = '' or question_text is null
          or length(trim(question_text)) < 20
          or question_text ilike '%extraction incomplete%'
          or question_text ilike '%see page%'
          or chapter ~ '^[0-9]+\\s*/\\s*[0-9]+$'
          or chapter ~ '^[0-9]+$'
       returning id`,
      [],
    );
    return { deleted: rows.length };
  });

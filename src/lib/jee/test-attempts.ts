import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { env } from "@/lib/env.server";
import type { SubjectId } from "@/lib/jee/types";

export type AiTestInsights = {
  summary: string;
  conceptualGaps: string[];
  carelessMistakes: string[];
  strongChapters: string[];
  moderateChapters: string[];
  needsAttention: string[];
  nextSteps: string[];
};

export type AttemptQuestion = {
  id: string;
  subject: SubjectId;
  chapter: string;
  source: string;
  type: "mcq" | "integer";
  question: string;
  options?: string[];
  correctAnswer: number;
  explanation: string;
  answerVerified?: boolean;
  visualQuestion?: boolean;
  hasVisualImage?: boolean;
  imageUrl?: string;
};

export type AttemptAnswer = {
  choice: number | null;
  numeric: string;
  review: boolean;
};

export type QuestionAnalysis = AttemptQuestion & {
  answer: AttemptAnswer;
  isCorrect: boolean | null;
  secondsSpent: number;
};

export type AttemptAnalysis = {
  correct: number;
  incorrect: number;
  unanswered: number;
  score: number;
  maxScore: number;
  elapsedSeconds: number;
  questions: QuestionAnalysis[];
  subjects: Record<SubjectId, {
    total: number;
    correct: number;
    incorrect: number;
    unanswered: number;
    score: number;
    seconds: number;
  }>;
  aiInsights?: AiTestInsights;
};

export type TestAttempt = {
  id: string;
  title: string;
  mode: "jee-main" | "custom";
  durationSeconds: number;
  createdAt: string;
  submittedAt: string | null;
  questions: AttemptQuestion[];
  answers: Record<string, AttemptAnswer>;
  analysis: AttemptAnalysis | null;
};

const SUBJECTS: SubjectId[] = ["physics", "chemistry", "maths"];
const isSubject = (value: unknown): value is SubjectId =>
  typeof value === "string" && SUBJECTS.includes(value as SubjectId);

function validateQuestion(question: AttemptQuestion): AttemptQuestion {
  if (!question || typeof question.id !== "string" || !question.id || question.id.length > 200) {
    throw new Error("A test question is missing its id.");
  }
  if (!isSubject(question.subject)) throw new Error("A test question has an invalid subject.");
  if (question.type !== "mcq" && question.type !== "integer") throw new Error("A test question has an invalid type.");
  if (typeof question.question !== "string" || question.question.length > 12_000) {
    throw new Error("A question is too long to save in a test.");
  }
  if (!Number.isFinite(question.correctAnswer)) throw new Error("A test question is missing its answer key.");
  const imageUrl =
    typeof question.imageUrl === "string" &&
    question.imageUrl.length <= 20_000 &&
    !question.imageUrl.startsWith("data:")
      ? question.imageUrl
      : undefined;
  return {
    id: question.id,
    subject: question.subject,
    chapter: String(question.chapter || "PYQ").slice(0, 200),
    source: String(question.source || "JEE Main PYQ").slice(0, 200),
    type: question.type,
    question: question.question,
    options: Array.isArray(question.options) ? question.options.slice(0, 6).map((option) => String(option).slice(0, 2000)) : [],
    correctAnswer: question.correctAnswer,
    explanation: String(question.explanation || "").slice(0, 12_000),
    answerVerified: question.answerVerified !== false,
    visualQuestion: Boolean(question.visualQuestion),
    hasVisualImage: Boolean(question.hasVisualImage),
    imageUrl,
  };
}

function safeAnswers(input: Record<string, AttemptAnswer>, questions: AttemptQuestion[]) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid answers.");
  const allowed = new Set(questions.map((question) => question.id));
  const result: Record<string, AttemptAnswer> = {};
  for (const [id, value] of Object.entries(input)) {
    if (!allowed.has(id) || !value || typeof value !== "object") continue;
    result[id] = {
      choice: Number.isInteger(value.choice) ? value.choice : null,
      numeric: typeof value.numeric === "string" ? value.numeric.slice(0, 100) : "",
      review: Boolean(value.review),
    };
  }
  return result;
}

function calculateAnalysis(
  questions: AttemptQuestion[],
  answers: Record<string, AttemptAnswer>,
  secondsByQuestion: Record<string, number>,
  elapsedSeconds: number,
): AttemptAnalysis {
  const subjects: AttemptAnalysis["subjects"] = {
    physics: { total: 0, correct: 0, incorrect: 0, unanswered: 0, score: 0, seconds: 0 },
    chemistry: { total: 0, correct: 0, incorrect: 0, unanswered: 0, score: 0, seconds: 0 },
    maths: { total: 0, correct: 0, incorrect: 0, unanswered: 0, score: 0, seconds: 0 },
  };
  let correct = 0;
  let incorrect = 0;
  let unanswered = 0;
  const reviewed = questions.map((question) => {
    const answer = answers[question.id] ?? { choice: null, numeric: "", review: false };
    const attempted = question.type === "mcq" ? answer.choice !== null : answer.numeric.trim() !== "";
    const isCorrect = !attempted
      ? null
      : question.type === "mcq"
        ? answer.choice === question.correctAnswer
        : Number.isInteger(Number(answer.numeric)) && Number(answer.numeric) === question.correctAnswer;
    const secondsSpent = Math.max(0, Math.min(86_400, Math.floor(Number(secondsByQuestion?.[question.id]) || 0)));
    const subject = subjects[question.subject];
    subject.total += 1;
    subject.seconds += secondsSpent;
    if (isCorrect === true) {
      correct += 1;
      subject.correct += 1;
      subject.score += 4;
    } else if (isCorrect === false) {
      incorrect += 1;
      subject.incorrect += 1;
      subject.score -= 1;
    } else {
      unanswered += 1;
      subject.unanswered += 1;
    }
    return { ...question, answer, isCorrect, secondsSpent };
  });
  return {
    correct,
    incorrect,
    unanswered,
    score: correct * 4 - incorrect,
    maxScore: questions.length * 4,
    elapsedSeconds: Math.max(0, Math.min(86_400, Math.floor(elapsedSeconds))),
    questions: reviewed,
    subjects,
  };
}

export const createTestAttempt = createServerFn({ method: "POST" })
  .validator((input: {
    title: string;
    mode: "jee-main" | "custom";
    durationSeconds: number;
    questions: AttemptQuestion[];
  }) => {
    if (!input || !Array.isArray(input.questions) || input.questions.length < 1 || input.questions.length > 75) {
      throw new Error("A test must have between 1 and 75 questions.");
    }
    if (!Number.isInteger(input.durationSeconds) || input.durationSeconds < 60 || input.durationSeconds > 18_000) {
      throw new Error("Choose a test time between 1 minute and 5 hours.");
    }
    if (input.mode !== "jee-main" && input.mode !== "custom") throw new Error("Invalid test type.");
    const questions = input.questions.map(validateQuestion);
    if (questions.reduce((total, question) => total + question.question.length, 0) > 500_000) {
      throw new Error("This test is too large to save.");
    }
    return {
      title: String(input.title || "Custom PYQ test").slice(0, 200),
      mode: input.mode,
      durationSeconds: input.durationSeconds,
      questions,
    };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const id = crypto.randomUUID();
    await sql`insert into jee_test_attempts (
      id, user_id, title, mode, duration_seconds, question_snapshot
    ) values (
      ${id}, ${context.userId}, ${data.title}, ${data.mode},
      ${data.durationSeconds}, ${JSON.stringify(data.questions)}::jsonb
    )`;
    return { id };
  });

export const getTestAttempt = createServerFn({ method: "GET" })
  .validator((id: string) => {
    if (typeof id !== "string" || id.length > 100) throw new Error("Invalid test id.");
    return id;
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<TestAttempt | null> => {
    const sql = await getSql();
    const rows = await sql.query<{
      id: string; title: string; mode: "jee-main" | "custom"; duration_seconds: number;
      created_at: string; submitted_at: string | null; question_snapshot: AttemptQuestion[];
      answer_snapshot: Record<string, AttemptAnswer>; analysis_snapshot: AttemptAnalysis | null;
    }>(
      `select id, title, mode, duration_seconds, created_at::text, submitted_at::text,
        question_snapshot, answer_snapshot, analysis_snapshot
       from jee_test_attempts where id = $1 and user_id = $2 limit 1`,
      [data, context.userId],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id, title: row.title, mode: row.mode, durationSeconds: row.duration_seconds,
      createdAt: row.created_at, submittedAt: row.submitted_at,
      questions: row.question_snapshot, answers: row.answer_snapshot ?? {},
      analysis: row.analysis_snapshot ?? null,
    };
  });

export const listTestAttempts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<TestAttempt[]> => {
    const sql = await getSql();
    const rows = await sql.query<{
      id: string; title: string; mode: "jee-main" | "custom"; duration_seconds: number;
      created_at: string; submitted_at: string | null; question_snapshot: AttemptQuestion[];
      answer_snapshot: Record<string, AttemptAnswer>; analysis_snapshot: AttemptAnalysis | null;
    }>(
      `select id, title, mode, duration_seconds, created_at::text, submitted_at::text,
        question_snapshot, answer_snapshot, analysis_snapshot
       from jee_test_attempts where user_id = $1 and submitted_at is not null
       order by submitted_at desc limit 50`,
      [context.userId],
    );
    return rows.map((row) => ({
      id: row.id, title: row.title, mode: row.mode, durationSeconds: row.duration_seconds,
      createdAt: row.created_at, submittedAt: row.submitted_at,
      questions: row.question_snapshot, answers: row.answer_snapshot ?? {},
      analysis: row.analysis_snapshot ?? null,
    }));
  });

export const completeTestAttempt = createServerFn({ method: "POST" })
  .validator((input: {
    id: string;
    answers: Record<string, AttemptAnswer>;
    secondsByQuestion: Record<string, number>;
    elapsedSeconds: number;
  }) => {
    if (!input || typeof input.id !== "string" || input.id.length > 100) throw new Error("Invalid test id.");
    if (!input.answers || typeof input.answers !== "object") throw new Error("Invalid answers.");
    if (!input.secondsByQuestion || typeof input.secondsByQuestion !== "object") throw new Error("Invalid question timing.");
    return {
      id: input.id,
      answers: input.answers,
      secondsByQuestion: input.secondsByQuestion,
      elapsedSeconds: Math.max(0, Math.min(86_400, Math.floor(Number(input.elapsedSeconds) || 0))),
    };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<AttemptAnalysis> => {
    const sql = await getSql();
    const rows = await sql.query<{ question_snapshot: AttemptQuestion[]; submitted_at: string | null }>(
      `select question_snapshot, submitted_at::text from jee_test_attempts
       where id = $1 and user_id = $2 limit 1`,
      [data.id, context.userId],
    );
    const row = rows[0];
    if (!row) throw new Error("Test attempt not found.");
    if (row.submitted_at) throw new Error("This test has already been submitted.");
    const questions = row.question_snapshot;
    const answers = safeAnswers(data.answers, questions);
    const analysis = calculateAnalysis(questions, answers, data.secondsByQuestion, data.elapsedSeconds);

    // A correctly answered PYQ should count in the Vault once, no matter how many tests include it.
    const solvedIds = [...new Set(analysis.questions
      .filter((question) => question.isCorrect === true)
      .map((question) => question.id))];
    let newlySolved: string[] = [];
    if (solvedIds.length > 0) {
      const saved = await sql.query<{ question_id: string }>(
        `insert into pyq_solved_questions (user_id, question_id)
         select $1, unnest($2::text[])
         on conflict (user_id, question_id) do nothing
         returning question_id`,
        [context.userId, solvedIds],
      );
      newlySolved = saved.map((item) => item.question_id);
    }

    // Award the same four XP used for a first-time Vault solve.
    const xpBySubject: Record<SubjectId, number> = { physics: 0, chemistry: 0, maths: 0 };
    const newlySolvedSet = new Set(newlySolved);
    for (const question of analysis.questions) {
      if (newlySolvedSet.has(question.id)) xpBySubject[question.subject] += 4;
    }
    const xpAdditions = Object.entries(xpBySubject) as Array<[SubjectId, number]>;
    if (newlySolved.length > 0) {
      await sql.query(
        `insert into question_days (user_id, day, physics, chemistry, maths)
         values ($1, (now() at time zone 'Asia/Kolkata')::date, $2, $3, $4)
         on conflict (user_id, day) do update set
           physics = question_days.physics + excluded.physics,
           chemistry = question_days.chemistry + excluded.chemistry,
           maths = question_days.maths + excluded.maths`,
        [context.userId, ...xpAdditions.map(([, xp]) => xp / 4)],
      );
    }
    await sql.query(
      `update jee_test_attempts set
        answer_snapshot = $3::jsonb,
        analysis_snapshot = $4::jsonb,
        elapsed_seconds = $5,
        submitted_at = now()
       where id = $1 and user_id = $2 and submitted_at is null`,
      [data.id, context.userId, JSON.stringify(answers), JSON.stringify(analysis), analysis.elapsedSeconds],
    );
    return analysis;
  });

export const generateTestInsights = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => {
    if (!input || typeof input.id !== "string" || input.id.length > 100) throw new Error("Invalid test id.");
    return { id: input.id };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<AiTestInsights> => {
    const sql = await getSql();
    const rows = await sql.query<{
      analysis_snapshot: AttemptAnalysis | null;
      question_snapshot: AttemptQuestion[];
      submitted_at: string | null;
    }>(
      `select analysis_snapshot, question_snapshot, submitted_at::text
       from jee_test_attempts where id = $1 and user_id = $2 limit 1`,
      [data.id, context.userId],
    );
    const attempt = rows[0];
    if (!attempt?.analysis_snapshot || !attempt.submitted_at) throw new Error("Submit the test before generating its AI analysis.");
    if (attempt.analysis_snapshot.aiInsights) return attempt.analysis_snapshot.aiInsights;

    const apiKey = env("GEMINI_API_KEY") ?? env("VITE_API_KEY") ?? env("VITE_GEMINI_API_KEY");
    if (!apiKey) throw new Error("AI analysis is not configured yet. Add GEMINI_API_KEY or VITE_API_KEY to the Vercel environment.");

    const analysis = attempt.analysis_snapshot;
    const chapterStats = new Map<string, { total: number; correct: number; wrong: number; unanswered: number; seconds: number }>();
    for (const question of analysis.questions) {
      const key = `${question.subject} / ${question.chapter}`;
      const current = chapterStats.get(key) ?? { total: 0, correct: 0, wrong: 0, unanswered: 0, seconds: 0 };
      current.total += 1;
      current.seconds += question.secondsSpent;
      if (question.isCorrect === true) current.correct += 1;
      else if (question.isCorrect === false) current.wrong += 1;
      else current.unanswered += 1;
      chapterStats.set(key, current);
    }
    const questionReview = analysis.questions.map((question, index) => ({
      number: index + 1,
      subject: question.subject,
      chapter: question.chapter,
      result: question.isCorrect === null ? "unanswered" : question.isCorrect ? "correct" : "wrong",
      seconds: question.secondsSpent,
      question: question.question.slice(0, 700),
      selected: question.type === "mcq"
        ? question.answer.choice === null ? "unanswered" : `option ${String.fromCharCode(65 + question.answer.choice)}`
        : question.answer.numeric || "unanswered",
      correctAnswer: question.type === "mcq" ? `option ${String.fromCharCode(65 + question.correctAnswer)}` : String(question.correctAnswer),
      explanation: question.explanation.slice(0, 350),
    }));
    const prompt = `You are a careful JEE Main performance coach. Analyze only the supplied test evidence. Do not claim certainty about a student's mental state: label careless mistakes as possible signs (for example, a fast wrong answer or a correct concept with a likely execution slip) and say when evidence is insufficient. Chapter labels: strong means at least 75% correct with at least 2 questions; moderate means 45%-74% with at least 2 questions; needs attention means below 45% with at least 2 questions. If fewer than 2 questions exist, say more practice is needed to assess. Conceptual gaps should cite the question/chapter evidence and distinguish them from speed/accuracy issues. Return ONLY valid JSON with string fields/arrays: {"summary":"...","conceptualGaps":["..."],"carelessMistakes":["..."],"strongChapters":["..."],"moderateChapters":["..."],"needsAttention":["..."],"nextSteps":["..."]}. Keep advice specific and actionable.\n\nTest totals: score ${analysis.score}/${analysis.maxScore}; ${analysis.correct} correct, ${analysis.incorrect} wrong, ${analysis.unanswered} unanswered; duration ${analysis.elapsedSeconds} seconds.\nChapter counts: ${JSON.stringify([...chapterStats.entries()].map(([chapter, stats]) => ({ chapter, ...stats })))}\nQuestion evidence: ${JSON.stringify(questionReview)}`;

    let response: Response | undefined;
    let payload: {
      error?: { message?: string };
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    } | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=" + encodeURIComponent(apiKey), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
            contents: [{ parts: [{ text: prompt }] }],
          }),
        });
        payload = await response.json() as {
          error?: { message?: string };
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
      } catch (error) {
        if (attempt === 2) throw error;
      }

      if (response?.ok) break;
      const retryable = !response || response.status === 429 || response.status === 500 ||
        response.status === 502 || response.status === 503 || response.status === 504;
      if (!retryable || attempt === 2) {
        throw new Error(payload?.error?.message || "Gemini could not analyze this test right now.");
      }
      await new Promise((resolve) => setTimeout(resolve, 800 * 2 ** attempt));
    }
    if (!response?.ok || !payload) {
      throw new Error(payload?.error?.message || "Gemini could not analyze this test right now.");
    }
    const raw = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
    if (!raw) throw new Error("The AI returned an empty analysis. Please try again.");
    let parsed: Partial<AiTestInsights>;
    try { parsed = JSON.parse(raw) as Partial<AiTestInsights>; }
    catch { throw new Error("The AI returned an unreadable analysis. Please try again."); }
    const insights: AiTestInsights = {
      summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 1200) : "Analysis generated.",
      conceptualGaps: Array.isArray(parsed.conceptualGaps) ? parsed.conceptualGaps.filter((x): x is string => typeof x === "string").slice(0, 8) : [],
      carelessMistakes: Array.isArray(parsed.carelessMistakes) ? parsed.carelessMistakes.filter((x): x is string => typeof x === "string").slice(0, 8) : [],
      strongChapters: Array.isArray(parsed.strongChapters) ? parsed.strongChapters.filter((x): x is string => typeof x === "string").slice(0, 12) : [],
      moderateChapters: Array.isArray(parsed.moderateChapters) ? parsed.moderateChapters.filter((x): x is string => typeof x === "string").slice(0, 12) : [],
      needsAttention: Array.isArray(parsed.needsAttention) ? parsed.needsAttention.filter((x): x is string => typeof x === "string").slice(0, 12) : [],
      nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps.filter((x): x is string => typeof x === "string").slice(0, 8) : [],
    };
    const updated = { ...analysis, aiInsights: insights };
    await sql.query(
      `update jee_test_attempts set analysis_snapshot = $3::jsonb where id = $1 and user_id = $2`,
      [data.id, context.userId, JSON.stringify(updated)],
    );
    return insights;
  });

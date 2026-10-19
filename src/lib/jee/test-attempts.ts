import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import type { SubjectId } from "@/lib/jee/types";

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

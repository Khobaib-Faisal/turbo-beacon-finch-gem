import type { SubjectId } from "@/lib/jee/types";

export type PyqQuestionType = "mcq" | "integer";

export type ExtractedQuestion = {
  /** Stable key for dedupe: subject|chapter|qN|sourceHash */
  externalKey: string;
  questionNumber: number | null;
  source: string;
  type: PyqQuestionType;
  questionText: string;
  options: string[] | null;
  /** Letter A-D or numeric string; unverified until reviewed */
  correctAnswer: string | null;
  topic: string | null;
  pageNumber: number | null;
  needsReview: boolean;
  flags: string[];
};

export type ExtractResult = {
  chapter: string;
  subject: SubjectId;
  sourcePdf: string;
  questions: ExtractedQuestion[];
  answerKey: Record<string, string>;
  warnings: string[];
};

export type ImportQuestionInput = {
  externalKey: string;
  subject: SubjectId;
  chapter: string;
  topic: string | null;
  source: string;
  questionNumber: number | null;
  type: PyqQuestionType;
  questionText: string;
  options: string[] | null;
  correctAnswer: string | null;
  pageNumber: number | null;
  needsReview: boolean;
  sourcePdf: string;
};

export type StoredPyqQuestion = {
  id: string;
  subject: SubjectId;
  chapter: string;
  topic: string | null;
  source: string;
  questionNumber: number | null;
  type: PyqQuestionType;
  questionText: string;
  options: string[] | null;
  correctAnswer: string | null;
  explanation: string;
  answerVerified: boolean;
  needsReview: boolean;
  pageNumber: number | null;
  sourcePdf: string | null;
  externalKey: string;
};

export type ChapterBundle = {
  chapter: string;
  subject: SubjectId;
  questions: Array<{
    id: string;
    source: string;
    type: PyqQuestionType;
    question: string;
    options?: string[];
    correctAnswer: number;
    explanation: string;
    imageUrl?: string;
    pageNumber?: number | null;
    needsReview?: boolean;
    answerVerified?: boolean;
  }>;
};

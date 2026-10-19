import type { SubjectId } from "@/lib/jee/types";

export type VaultQuestion = {
  id: string;
  source: string;
  type: "mcq" | "integer";
  question: string;
  imageUrl?: string;
  options?: string[];
  correctAnswer: number;
  explanation: string;
};

export type VaultChapter = {
  chapter: string;
  subject: SubjectId;
  questions: VaultQuestion[];
};

/** Merge static JSON chapters with DB chapters (DB appends by id). */
export function mergeVaultChapters(
  staticChapters: VaultChapter[],
  dbChapters: VaultChapter[],
): VaultChapter[] {
  const map = new Map<string, VaultChapter>();
  for (const ch of staticChapters) {
    map.set(ch.chapter, {
      chapter: ch.chapter,
      subject: ch.subject,
      questions: [...(ch.questions || [])],
    });
  }
  for (const ch of dbChapters) {
    const existing = map.get(ch.chapter);
    if (!existing) {
      map.set(ch.chapter, {
        chapter: ch.chapter,
        subject: ch.subject,
        questions: [...(ch.questions || [])],
      });
    } else {
      const seen = new Set(existing.questions.map((q) => q.id));
      for (const q of ch.questions || []) {
        if (!seen.has(q.id)) existing.questions.push(q);
      }
    }
  }
  return [...map.values()];
}

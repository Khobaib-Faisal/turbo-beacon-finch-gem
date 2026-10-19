import { useCallback, useEffect, useMemo, useState } from "react";
import { BrainCircuit, ExternalLink, History, Layers3, RefreshCw, ShieldCheck } from "lucide-react";
import { createTestAttempt, listTestAttempts, type TestAttempt } from "@/lib/jee/test-attempts";
import { getPyqQuestionImage, listPyqChapters } from "@/lib/pyq/api";
import { mergeVaultChapters, type VaultChapter, type VaultQuestion } from "@/lib/pyq/merge-chapters";
import type { SubjectId } from "@/lib/jee/types";

const SUBJECTS: Array<{ id: SubjectId; name: string }> = [
  { id: "physics", name: "Physics" },
  { id: "chemistry", name: "Chemistry" },
  { id: "maths", name: "Mathematics" },
];

type BankQuestion = VaultQuestion & { subject: SubjectId; chapter: string };
type Mode = "custom" | "jee-main";
type ChapterSelections = Partial<Record<SubjectId, string[]>>;

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function usable(question: VaultQuestion): boolean {
  const visual = Boolean(question.hasVisualImage || question.visualQuestion || question.imageUrl);
  const stem = question.question?.trim() ?? "";
  const readable = visual || (stem.length >= 20 && !/\[Extraction incomplete|unreadable|see page/i.test(stem));
  const answerPresent = question.answerAvailable !== false && Number.isFinite(question.correctAnswer);
  const validKey = question.type === "integer" ||
    (Number.isInteger(question.correctAnswer) && question.correctAnswer >= 0 && question.correctAnswer <= 3);
  const hasChoices = question.type === "integer" || visual || (question.options?.length ?? 0) >= 2;
  return readable && answerPresent && validKey && hasChoices;
}

function dateLabel(value: string | null): string {
  if (!value) return "In progress";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatClock(seconds: number): string {
  const bounded = Math.max(0, seconds);
  return [Math.floor(bounded / 3600), Math.floor((bounded % 3600) / 60), bounded % 60]
    .map((part) => String(part).padStart(2, "0")).join(":");
}

function aiSummary(attempt: TestAttempt): string {
  const analysis = attempt.analysis;
  if (!analysis) return `Please analyze my JEE PYQ test titled "${attempt.title}". It is not submitted yet.`;
  const subjectLines = SUBJECTS.map(({ id, name }) => {
    const item = analysis.subjects[id];
    return `${name}: ${item.correct}/${item.total} correct, ${item.incorrect} wrong, ${item.unanswered} unanswered, ${Math.round(item.seconds / 60)} min spent.`;
  }).join("\n");
  const wrong = analysis.questions.filter((question) => question.isCorrect === false).slice(0, 25);
  const wrongLines = wrong.map((question) =>
    `- ${question.subject} / ${question.chapter}: ${question.question.slice(0, 700)} | chosen: ${question.type === "mcq" ? String.fromCharCode(65 + (question.answer.choice ?? 0)) : question.answer.numeric} | correct: ${question.type === "mcq" ? String.fromCharCode(65 + question.correctAnswer) : question.correctAnswer} | ${question.explanation.slice(0, 400)}`
  ).join("\n");
  return `Analyze my JEE test "${attempt.title}" from ${dateLabel(attempt.submittedAt)}. Score ${analysis.score}/${analysis.maxScore}; ${analysis.correct} correct, ${analysis.incorrect} wrong, ${analysis.unanswered} unanswered. Total time: ${formatClock(analysis.elapsedSeconds)}.\nSubject time and results:\n${subjectLines}\nQuestions I got wrong:\n${wrongLines || "None"}\nPlease identify patterns in my mistakes, give practical next steps, and explain which chapters I should revise first.`;
}

export function TestGenerator({ onAskAi }: { onAskAi?: (context: string) => void }) {
  const [chapters, setChapters] = useState<VaultChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("custom");
  const [selectedSubjects, setSelectedSubjects] = useState<SubjectId[]>(["physics", "chemistry", "maths"]);
  const [chapterSelections, setChapterSelections] = useState<ChapterSelections>({});
  const [questionCount, setQuestionCount] = useState(30);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [configError, setConfigError] = useState<string | null>(null);
  const [history, setHistory] = useState<TestAttempt[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      setHistory(await listTestAttempts());
      setHistoryError(null);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "Could not load saved test history.");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      SUBJECTS.map(async ({ id }) => {
        const [staticChapters, dbChapters] = await Promise.all([
          fetch("/data/" + id + ".json")
            .then((response) => response.ok ? response.json() as Promise<VaultChapter[]> : [])
            .catch(() => [] as VaultChapter[]),
          listPyqChapters({ data: { subject: id } }).catch(() => [] as VaultChapter[]),
        ]);
        return mergeVaultChapters(staticChapters, dbChapters);
      }),
    ).then((results) => {
      if (!cancelled) {
        setChapters(results.flat());
        setLoadError(null);
      }
    }).catch((error: unknown) => {
      if (!cancelled) setLoadError(error instanceof Error ? error.message : "Could not load the PYQ vault.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    void refreshHistory();
    return () => { cancelled = true; };
  }, [refreshHistory]);

  useEffect(() => {
    const update = () => { if (document.visibilityState === "visible") void refreshHistory(); };
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [refreshHistory]);

  const bank = useMemo(() => chapters.flatMap((chapter) =>
    chapter.questions.filter(usable).map((question) => ({
      ...question, subject: chapter.subject, chapter: chapter.chapter,
    })),
  ), [chapters]);

  const chapterOptions = useMemo(() => Object.fromEntries(
    SUBJECTS.map(({ id }) => [
      id,
      [...new Set(chapters.filter((chapter) => chapter.subject === id && chapter.questions.some(usable))
        .map((chapter) => chapter.chapter))].sort((a, b) => a.localeCompare(b)),
    ]),
  ) as Record<SubjectId, string[]>, [chapters]);

  const selectedPool = useMemo(() => bank.filter((question) => {
    if (!selectedSubjects.includes(question.subject)) return false;
    const chaptersForSubject = chapterSelections[question.subject];
    return chaptersForSubject === undefined || chaptersForSubject.includes(question.chapter);
  }), [bank, selectedSubjects, chapterSelections]);

  const countsBySubject = useMemo(() => Object.fromEntries(SUBJECTS.map(({ id }) => {
    const scoped = selectedPool.filter((question) => question.subject === id);
    return [id, {
      total: scoped.length,
      mcq: scoped.filter((question) => question.type === "mcq").length,
      numerical: scoped.filter((question) => question.type === "integer").length,
    }];
  })) as Record<SubjectId, { total: number; mcq: number; numerical: number }>, [selectedPool]);

  const balanceError = selectedSubjects.length > 0 && questionCount % selectedSubjects.length !== 0
    ? `Choose a question count divisible by ${selectedSubjects.length} selected subject${selectedSubjects.length > 1 ? "s" : ""} for an equal split.`
    : null;
  const perSubject = selectedSubjects.length ? questionCount / selectedSubjects.length : 0;
  const shortage = selectedSubjects.find((subject) => countsBySubject[subject].total < perSubject);
  const fullReady = SUBJECTS.every(({ id }) => {
    const pool = bank.filter((question) => question.subject === id);
    return pool.filter((question) => question.type === "mcq").length >= 20 &&
      pool.filter((question) => question.type === "integer").length >= 5;
  });

  function toggleSubject(subject: SubjectId) {
    setSelectedSubjects((current) => current.includes(subject)
      ? current.filter((item) => item !== subject)
      : [...current, subject]);
    setConfigError(null);
  }

  function toggleChapter(subject: SubjectId, chapter: string) {
    setChapterSelections((current) => {
      const existing = current[subject];
      const all = chapterOptions[subject];
      const chosen = existing ?? [...all];
      const next = chosen.includes(chapter) ? chosen.filter((value) => value !== chapter) : [...chosen, chapter];
      if (next.length === all.length) {
        const copy = { ...current };
        delete copy[subject];
        return copy;
      }
      return { ...current, [subject]: next };
    });
    setConfigError(null);
  }

  async function startTest() {
    setConfigError(null);
    if (starting) return;
    const subjects = mode === "jee-main" ? SUBJECTS.map((subject) => subject.id) : selectedSubjects;
    if (subjects.length === 0) {
      setConfigError("Select at least one subject.");
      return;
    }
    const popup = window.open("about:blank", "_blank");
    if (!popup) {
      setConfigError("Allow pop-ups for this site so the test can open in its own tab.");
      return;
    }
    popup.document.title = "Preparing your test…";
    popup.document.body.innerHTML = '<main style="font:16px system-ui;margin:12vh auto;max-width:520px;padding:24px;color:#f3ecdf;background:#14120e"><p>Preparing your test…</p><p>You can keep this tab open while the test loads.</p></main>';
    popup.opener = null;
    setStarting(true);
    try {
      let selected: BankQuestion[] = [];
      if (mode === "jee-main") {
        for (const subject of SUBJECTS) {
          const pool = bank.filter((question) => question.subject === subject.id);
          const mcq = shuffle(pool.filter((question) => question.type === "mcq"));
          const numerical = shuffle(pool.filter((question) => question.type === "integer"));
          if (mcq.length < 20 || numerical.length < 5) {
            throw new Error(`${subject.name} needs 20 usable MCQs and 5 usable numerical PYQs. Available: ${mcq.length} MCQs and ${numerical.length} numerical.`);
          }
          selected.push(...mcq.slice(0, 20), ...numerical.slice(0, 5));
        }
      } else {
        if (balanceError) throw new Error(balanceError);
        if (shortage) throw new Error(`${SUBJECTS.find((item) => item.id === shortage)?.name} has only ${countsBySubject[shortage].total} usable questions. Select fewer questions or more chapters.`);
        for (const subject of subjects) {
          selected.push(...shuffle(selectedPool.filter((question) => question.subject === subject)).slice(0, perSubject));
        }
      }
      selected = shuffle(selected);
      const title = mode === "jee-main" ? "JEE Main Paper 1 · 75 Questions" : `Custom PYQ test · ${questionCount} questions`;
      const duration = mode === "jee-main" ? 180 : durationMinutes;
      const { id } = await createTestAttempt({
        data: {
          title,
          mode,
          durationSeconds: duration * 60,
          questions: selected,
        },
      });
      popup.location.replace("/test/" + encodeURIComponent(id));
    } catch (error) {
      popup.close();
      setConfigError(error instanceof Error ? error.message : "Could not start this test.");
    } finally {
      setStarting(false);
    }
  }

  const outer = "rounded-2xl border border-line bg-surface p-4 sm:p-5";
  const button = "min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-40";

  if (loading) {
    return <section className={outer}><h2 className="text-lg font-semibold text-fg">JEE Main Test Generator</h2><p className="mt-3 text-sm text-muted">Loading your PYQ vault…</p></section>;
  }

  return (
    <div className="mt-4 space-y-4 animate-in fade-in duration-200">
      <section className={outer}>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">PYQ powered</p>
            <h2 className="mt-1 text-lg font-semibold text-fg">Create a JEE Main test</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">Choose chapters, balance Physics, Chemistry and Maths, set the timer, and start in a separate tab.</p>
          </div>
          <span className="rounded-lg bg-raised px-2.5 py-1 text-xs font-medium text-accent">{bank.length} readable questions with answer keys</span>
        </div>

        {loadError ? <p role="alert" className="mt-4 rounded-xl border border-line bg-bg p-3 text-sm text-muted">{loadError}</p> : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => { setMode("custom"); setConfigError(null); }}
            className={"rounded-xl border p-4 text-left " + (mode === "custom" ? "border-accent bg-accent/10" : "border-line bg-bg")}>
            <span className="block font-semibold text-fg">Custom test</span>
            <span className="mt-1 block text-xs text-muted">Choose your subjects, chapters, question count, and time.</span>
          </button>
          <button type="button" onClick={() => { setMode("jee-main"); setConfigError(null); }}
            className={"rounded-xl border p-4 text-left " + (mode === "jee-main" ? "border-accent bg-accent/10" : "border-line bg-bg")}>
            <span className="block font-semibold text-fg">JEE Main Paper 1 template</span>
            <span className="mt-1 block text-xs text-muted">75 questions · 3 hours · 25 questions per PCM subject.</span>
            <span className="mt-1 block text-xs text-muted">Per subject: 20 MCQ + 5 numerical. {fullReady ? "Ready to generate." : "Your current vault may not have the full quota yet."}</span>
          </button>
        </div>

        {mode === "custom" ? (
          <div className="mt-4 space-y-4">
            <fieldset>
              <legend className="text-xs font-semibold text-fg">Subjects to include</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {SUBJECTS.map(({ id, name }) => (
                  <label key={id} className="flex min-h-12 items-center gap-3 rounded-xl border border-line bg-bg px-3 text-sm text-fg">
                    <input type="checkbox" checked={selectedSubjects.includes(id)} onChange={() => toggleSubject(id)} />
                    {name}<span className="ml-auto text-xs text-muted">{countsBySubject[id].total} usable</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-3 lg:grid-cols-3">
              {SUBJECTS.filter(({ id }) => selectedSubjects.includes(id)).map(({ id, name }) => {
                const options = chapterOptions[id];
                const chosen = chapterSelections[id];
                return (
                  <fieldset key={id} className="rounded-xl border border-line bg-bg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <legend className="text-xs font-semibold text-fg">{name} chapters</legend>
                      <button type="button" onClick={() => setChapterSelections((current) => {
                        const copy = { ...current }; delete copy[id]; return copy;
                      })} className="text-[11px] font-medium text-accent">All chapters</button>
                    </div>
                    <div className="mt-2 max-h-44 space-y-1 overflow-y-auto">
                      {options.length ? options.map((chapter) => (
                        <label key={chapter} className="flex items-start gap-2 rounded-lg px-1 py-1 text-xs text-muted">
                          <input type="checkbox" checked={chosen === undefined || chosen.includes(chapter)}
                            onChange={() => toggleChapter(id, chapter)} className="mt-0.5" />
                          <span>{chapter}</span>
                        </label>
                      )) : <p className="text-xs text-muted">No usable chapter questions yet.</p>}
                    </div>
                  </fieldset>
                );
              })}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-muted">Number of questions
                <input type="number" min="1" max="75" value={questionCount}
                  onChange={(event) => setQuestionCount(Math.max(1, Math.min(75, Number(event.target.value) || 1)))}
                  className="mt-1 min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-base text-fg" />
              </label>
              <label className="text-xs font-medium text-muted">Time limit
                <select value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))}
                  className="mt-1 min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-base text-fg">
                  {[15, 30, 45, 60, 90, 120, 150, 180].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
                </select>
              </label>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-line bg-bg px-3 py-2 text-xs text-muted">
              <Layers3 className="size-4 shrink-0" />
              <span>{questionCount} questions across {selectedSubjects.length} subjects. {selectedSubjects.length ? `${perSubject} each` : "Select a subject"}.</span>
            </div>
            {balanceError ? <p role="alert" className="text-sm text-muted">{balanceError}</p> : null}
            {shortage ? <p role="alert" className="text-sm text-muted">{SUBJECTS.find((item) => item.id === shortage)?.name} has only {countsBySubject[shortage].total} usable questions for this split.</p> : null}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-line bg-bg p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">Full-paper question pool</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {SUBJECTS.map(({ id, name }) => {
                    const pool = bank.filter((question) => question.subject === id);
                    const mcq = pool.filter((question) => question.type === "mcq").length;
                    const numerical = pool.filter((question) => question.type === "integer").length;
                    return <div key={id} className="rounded-lg border border-line bg-surface px-3 py-2"><p className="text-xs font-semibold text-fg">{name}</p><p className="mt-1 text-xs text-muted">{mcq} MCQ · {numerical} numerical</p><p className="mt-1 text-[11px] text-muted">{mcq >= 20 && numerical >= 5 ? "Quota ready" : "More keyed questions needed"}</p></div>;
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {configError ? <p role="alert" className="mt-4 rounded-xl border border-line bg-bg p-3 text-sm text-muted">{configError}</p> : null}
        <button type="button" disabled={starting || (mode === "jee-main" ? !fullReady : !selectedSubjects.length || Boolean(balanceError) || Boolean(shortage))}
          onClick={() => void startTest()} className={button + " mt-4 w-full sm:w-auto"}>
          {starting ? "Preparing separate test tab…" : mode === "jee-main" ? "Start 75-question JEE Main test" : "Create and open custom test"}
        </button>
      </section>

      <section className={outer}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
          <div><div className="flex items-center gap-2"><History className="size-4 text-muted" /><h2 className="font-semibold text-fg">Past tests</h2></div><p className="mt-1 text-xs text-muted">Saved with the date, score, and detailed answer analysis.</p></div>
          <button type="button" onClick={() => void refreshHistory()} disabled={historyLoading} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-bg px-3 text-xs text-fg disabled:opacity-50"><RefreshCw className={"size-3.5 " + (historyLoading ? "animate-spin" : "")} /> Refresh</button>
        </div>
        {historyError ? <p role="alert" className="mt-3 text-sm text-muted">{historyError}</p> : null}
        {historyLoading && !history.length ? <p className="mt-3 text-sm text-muted">Loading saved tests…</p> : null}
        {!historyLoading && !history.length && !historyError ? <p className="mt-3 rounded-xl border border-dashed border-line p-4 text-sm text-muted">Completed tests will appear here with question-by-question results and timing.</p> : null}
        {history.length ? <div className="mt-3 space-y-3">
          {history.map((attempt) => {
            const analysis = attempt.analysis;
            const percent = analysis ? Math.round((analysis.score / Math.max(analysis.maxScore, 1)) * 100) : 0;
            return <article key={attempt.id} className="rounded-xl border border-line bg-bg p-3 sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-fg">{attempt.title}</h3>
                  <p className="mt-1 text-xs text-muted">{dateLabel(attempt.submittedAt)} · {attempt.questions.length} questions · {formatClock(analysis?.elapsedSeconds ?? attempt.durationSeconds)}</p>
                  <p className="mt-2 text-sm text-fg">{analysis?.score ?? "—"} / {analysis?.maxScore ?? "—"} marks <span className="text-muted">· {percent}% · {analysis?.correct ?? 0} right · {analysis?.incorrect ?? 0} wrong · {analysis?.unanswered ?? 0} unanswered</span></p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => window.open("/test/" + encodeURIComponent(attempt.id), "_blank")}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-raised px-3 text-xs font-medium text-fg"><ExternalLink className="size-3.5" /> View analysis</button>
                  {onAskAi ? <button type="button" onClick={() => onAskAi(aiSummary(attempt))}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-raised px-3 text-xs font-medium text-fg"><BrainCircuit className="size-3.5" /> Ask AI about this test</button> : null}
                </div>
              </div>
              {analysis ? <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {SUBJECTS.map(({ id, name }) => <div key={id} className="rounded-lg border border-line bg-surface px-3 py-2 text-xs"><div className="flex justify-between gap-2"><span className="font-semibold text-fg">{name}</span><span className="text-muted">{analysis.subjects[id].correct}/{analysis.subjects[id].total} correct</span></div><p className="mt-1 text-muted">Time spent {formatClock(analysis.subjects[id].seconds)}</p></div>)}
              </div> : null}
            </article>;
          })}
        </div> : null}
      </section>
    </div>
  );
}

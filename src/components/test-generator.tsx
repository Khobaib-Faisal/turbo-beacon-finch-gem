import { useEffect, useMemo, useState } from "react";
import { Check, Clock3, RotateCcw, Send, ShieldCheck } from "lucide-react";
import { getPyqQuestionImage, listPyqChapters } from "@/lib/pyq/api";
import { mergeVaultChapters, type VaultChapter, type VaultQuestion } from "@/lib/pyq/merge-chapters";
import type { SubjectId } from "@/lib/jee/types";

const SUBJECTS: Array<{ id: SubjectId; name: string }> = [
  { id: "physics", name: "Physics" },
  { id: "chemistry", name: "Chemistry" },
  { id: "maths", name: "Mathematics" },
];

type TestQuestion = VaultQuestion & { subject: SubjectId; chapter: string };
type TestAnswer = { choice: number | null; numeric: string; review: boolean };
type TestMode = "jee-main" | "custom";
type SubjectFilter = SubjectId | "all";

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
  const validKey =
    question.type === "integer" ||
    (Number.isInteger(question.correctAnswer) && question.correctAnswer >= 0 && question.correctAnswer <= 3);
  const hasChoices = question.type === "integer" || visual || (question.options?.length ?? 0) >= 2;
  return readable && answerPresent && validKey && hasChoices;
}

function clock(seconds: number): string {
  const parts = [
    Math.floor(seconds / 3600),
    Math.floor((seconds % 3600) / 60),
    seconds % 60,
  ];
  return parts.map((part) => String(part).padStart(2, "0")).join(":");
}

function blankAnswer(): TestAnswer {
  return { choice: null, numeric: "", review: false };
}

export function TestGenerator() {
  const [chapters, setChapters] = useState<VaultChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<TestMode>("jee-main");
  const [subjectFilter, setSubjectFilter] = useState<SubjectFilter>("all");
  const [chapterFilter, setChapterFilter] = useState("all");
  const [questionCount, setQuestionCount] = useState(30);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [configError, setConfigError] = useState<string | null>(null);

  const [run, setRun] = useState<TestQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, TestAnswer>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [image, setImage] = useState<{ id: string; url: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(
      SUBJECTS.map(async ({ id }) => {
        const [staticChapters, dbChapters] = await Promise.all([
          fetch("/data/" + id + ".json")
            .then((response) => (response.ok ? (response.json() as Promise<VaultChapter[]>) : []))
            .catch(() => [] as VaultChapter[]),
          listPyqChapters({ data: { subject: id } }).catch(() => [] as VaultChapter[]),
        ]);
        return mergeVaultChapters(staticChapters, dbChapters);
      }),
    )
      .then((results) => {
        if (!cancelled) {
          setChapters(results.flat());
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Could not load the PYQ vault.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const questionBank = useMemo(
    () =>
      chapters.flatMap((chapter) =>
        chapter.questions
          .filter(usable)
          .map((question) => ({ ...question, subject: chapter.subject, chapter: chapter.chapter })),
      ),
    [chapters],
  );

  const bankCounts = useMemo(
    () =>
      Object.fromEntries(
        SUBJECTS.map(({ id }) => {
          const items = questionBank.filter((question) => question.subject === id);
          return [
            id,
            {
              total: items.length,
              mcq: items.filter((question) => question.type === "mcq").length,
              numerical: items.filter((question) => question.type === "integer").length,
            },
          ];
        }),
      ) as Record<SubjectId, { total: number; mcq: number; numerical: number }>,
    [questionBank],
  );

  const customPool = useMemo(
    () =>
      questionBank.filter(
        (question) =>
          (subjectFilter === "all" || question.subject === subjectFilter) &&
          (chapterFilter === "all" ||
            question.subject + "|" + question.chapter === chapterFilter),
      ),
    [questionBank, subjectFilter, chapterFilter],
  );

  const chapterOptions = useMemo(
    () =>
      chapters
        .filter((chapter) => subjectFilter === "all" || chapter.subject === subjectFilter)
        .filter((chapter) => chapter.questions.some(usable))
        .map((chapter) => ({
          value: chapter.subject + "|" + chapter.chapter,
          subject: SUBJECTS.find((item) => item.id === chapter.subject)?.name ?? chapter.subject,
          chapter: chapter.chapter,
          count: chapter.questions.filter(usable).length,
        })),
    [chapters, subjectFilter],
  );

  const active = run?.[currentIndex] ?? null;
  const activeAnswer = active ? answers[active.id] ?? blankAnswer() : blankAnswer();
  const activeVisual = Boolean(active?.hasVisualImage || active?.visualQuestion || active?.imageUrl);

  useEffect(() => {
    let cancelled = false;
    setImage(null);
    if (!active) return;
    if (!active.hasVisualImage) {
      if (active.imageUrl) setImage({ id: active.id, url: active.imageUrl });
      return;
    }
    getPyqQuestionImage({ data: { id: active.id } })
      .then(({ imageUrl }) => {
        if (!cancelled) setImage({ id: active.id, url: imageUrl });
      })
      .catch(() => {
        if (!cancelled) setImage({ id: active.id, url: null });
      });
    return () => {
      cancelled = true;
    };
  }, [active?.id, active?.hasVisualImage, active?.imageUrl]);

  useEffect(() => {
    if (!run || submitted) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((remaining) => Math.max(remaining - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [Boolean(run && !submitted)]);

  useEffect(() => {
    if (run && secondsLeft === 0 && !submitted) setSubmitted(true);
  }, [run, secondsLeft, submitted]);

  const result = useMemo(() => {
    if (!run) return { correct: 0, incorrect: 0, unanswered: 0, marks: 0, unverified: 0 };
    let correct = 0;
    let incorrect = 0;
    let unanswered = 0;
    let marks = 0;
    let unverified = 0;
    for (const question of run) {
      const answer = answers[question.id] ?? blankAnswer();
      const attempted = question.type === "mcq" ? answer.choice !== null : answer.numeric.trim() !== "";
      const right =
        question.type === "mcq"
          ? answer.choice === question.correctAnswer
          : Number.isInteger(Number(answer.numeric)) && Number(answer.numeric) === question.correctAnswer;
      if (!attempted) unanswered += 1;
      else if (right) {
        correct += 1;
        marks += 4;
      } else {
        incorrect += 1;
        marks -= 1;
      }
      if (question.answerVerified === false) unverified += 1;
    }
    return { correct, incorrect, unanswered, marks, unverified };
  }, [run, answers]);

  function updateAnswer(question: TestQuestion, patch: Partial<TestAnswer>) {
    setAnswers((previous) => ({
      ...previous,
      [question.id]: { ...(previous[question.id] ?? blankAnswer()), ...patch },
    }));
  }

  function generate() {
    setConfigError(null);
    let selected: TestQuestion[] = [];
    let minutes = durationMinutes;

    if (mode === "jee-main") {
      for (const subject of SUBJECTS) {
        const pool = questionBank.filter((question) => question.subject === subject.id);
        const mcq = shuffle(pool.filter((question) => question.type === "mcq"));
        const numerical = shuffle(pool.filter((question) => question.type === "integer"));
        if (mcq.length < 20 || numerical.length < 5) {
          setConfigError(
            subject.name + " needs 20 MCQs and 5 numerical PYQs with answer keys. Available: " +
              mcq.length + " MCQs, " + numerical.length + " numerical.",
          );
          return;
        }
        selected.push(...mcq.slice(0, 20), ...numerical.slice(0, 5));
      }
      minutes = 180;
    } else {
      if (customPool.length < questionCount) {
        setConfigError("This selection has " + customPool.length + " usable, keyed PYQs. Lower the question count or add more questions.");
        return;
      }
      selected = shuffle(customPool).slice(0, questionCount);
    }

    setRun(shuffle(selected));
    setAnswers({});
    setCurrentIndex(0);
    setSecondsLeft(minutes * 60);
    setSubmitted(false);
    setImage(null);
  }

  function submit() {
    if (!submitted && !window.confirm("Submit this test now? Unanswered questions will score 0.")) return;
    setSubmitted(true);
    setSecondsLeft(0);
  }

  function reset() {
    setRun(null);
    setAnswers({});
    setCurrentIndex(0);
    setSecondsLeft(0);
    setSubmitted(false);
    setImage(null);
  }

  const outer = "rounded-2xl border border-line bg-surface p-4 sm:p-5";
  const button = "min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-40";

  if (loading) {
    return (
      <section className={outer}>
        <h2 className="text-lg font-semibold text-fg">JEE Main Test Generator</h2>
        <p className="mt-3 text-sm text-muted">Loading the PYQ vault…</p>
      </section>
    );
  }

  if (run) {
    const attempted = run.length - result.unanswered;
    const marked = run.filter((question) => answers[question.id]?.review).length;
    const options = active?.options?.length ? active.options : ["A", "B", "C", "D"];
    const isFullPaper = run.length === 75;

    return (
      <section className="mt-4 space-y-4 animate-in fade-in duration-200">
        <div className={outer}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted">
                {isFullPaper ? "JEE Main 2026 · Paper 1" : "Custom PYQ practice"}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-fg">{submitted ? "Test complete" : "Timed test"}</h2>
            </div>
            <div
              aria-live="polite"
              className={
                "flex items-center gap-2 rounded-xl border px-3 py-2 font-mono text-sm tabular-nums " +
                (secondsLeft <= 300 && !submitted ? "border-accent bg-accent/10 text-accent" : "border-line bg-bg text-fg")
              }
            >
              <Clock3 className="size-4" /> {clock(secondsLeft)}
            </div>
          </div>

          {submitted ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              {[
                ["Score", result.marks + " / " + run.length * 4],
                ["Correct", String(result.correct)],
                ["Incorrect", String(result.incorrect)],
                ["Unanswered", String(result.unanswered)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-line bg-bg p-3">
                  <p className="text-xs text-muted">{label}</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-fg">{value}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              <span>{run.length} questions</span>
              <span>{attempted} attempted</span>
              <span>{marked} marked for review</span>
              <span>+4 correct · −1 incorrect</span>
            </div>
          )}

          {submitted && result.unverified > 0 ? (
            <p className="mt-3 rounded-xl border border-line bg-bg px-3 py-2 text-xs text-muted">
              Provisional score: answer keys for {result.unverified} question(s) have not been verified.
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_250px]">
          <div className={outer}>
            {active ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line pb-3">
                  <div>
                    <p className="text-xs text-muted">
                      {SUBJECTS.find((subject) => subject.id === active.subject)?.name} · {active.chapter}
                    </p>
                    <h3 className="mt-1 font-semibold text-fg">
                      Question {currentIndex + 1}
                      <span className="ml-2 text-xs font-normal text-muted">
                        {active.type === "mcq" ? "Multiple choice" : "Numerical value"}
                      </span>
                    </h3>
                  </div>
                  {active.answerVerified === false ? (
                    <span className="rounded-lg border border-line px-2 py-1 text-[11px] text-muted">Key unverified</span>
                  ) : null}
                </div>

                <div className="mt-4">
                  {activeVisual ? (
                    image?.id === active.id && image.url ? (
                      <img
                        src={image.url}
                        alt={"Question " + (currentIndex + 1) + " with original math and diagram"}
                        className="mx-auto max-h-[28rem] w-full rounded-xl border border-line bg-bg object-contain"
                      />
                    ) : (
                      <div className="rounded-xl border border-dashed border-line p-5 text-center text-sm text-muted">
                        {image?.id === active.id ? "Question image could not be loaded." : "Loading question image…"}
                      </div>
                    )
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{active.question}</p>
                  )}

                  {active.type === "mcq" ? (
                    <div className="mt-5 grid gap-2">
                      {options.map((option, index) => {
                        const selected = activeAnswer.choice === index;
                        const correct = active.correctAnswer === index;
                        let style = "border-line bg-bg text-fg hover:border-muted";
                        if (submitted && correct) style = "border-accent bg-accent/10 text-fg";
                        else if (selected) style = "border-accent bg-accent/10 text-fg";
                        return (
                          <button
                            type="button"
                            key={index}
                            disabled={submitted}
                            onClick={() => updateAnswer(active, { choice: index })}
                            className={"flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm " + style}
                          >
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line text-xs font-semibold">
                              {String.fromCharCode(65 + index)}
                            </span>
                            {active.hasVisualImage || active.visualQuestion ? null : <span>{option}</span>}
                            {submitted && correct ? <Check className="ml-auto size-4 shrink-0" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <label className="mt-5 block max-w-sm text-xs font-medium text-muted">
                      Numerical answer
                      <input
                        type="number"
                        step="1"
                        inputMode="numeric"
                        disabled={submitted}
                        value={activeAnswer.numeric}
                        onChange={(event) => updateAnswer(active, { numeric: event.target.value })}
                        placeholder="Enter an integer"
                        className="mt-1 min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-base text-fg"
                      />
                    </label>
                  )}

                  {submitted ? (
                    <div className="mt-5 rounded-xl border border-line bg-bg p-4 text-sm">
                      <p className="font-semibold text-fg">
                        Answer: {active.type === "mcq" ? String.fromCharCode(65 + active.correctAnswer) : active.correctAnswer}
                      </p>
                      {active.explanation ? (
                        <p className="mt-2 whitespace-pre-wrap leading-relaxed text-muted">{active.explanation}</p>
                      ) : null}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => updateAnswer(active, { review: !activeAnswer.review })}
                      className="mt-4 min-h-10 rounded-xl border border-line bg-bg px-3 text-xs font-medium text-fg"
                    >
                      {activeAnswer.review ? "Remove review mark" : "Mark for review"}
                    </button>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between gap-2 border-t border-line pt-4">
                  <button
                    type="button"
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex((index) => Math.max(index - 1, 0))}
                    className="min-h-11 rounded-xl border border-line bg-bg px-4 text-sm text-fg disabled:opacity-40"
                  >
                    Previous
                  </button>
                  {currentIndex < run.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => setCurrentIndex((index) => Math.min(index + 1, run.length - 1))}
                      className={button}
                    >
                      {submitted ? "Next answer" : "Save & Next"}
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>

          <aside className={outer}>
            <h3 className="font-semibold text-fg">Question palette</h3>
            <p className="mt-1 text-xs text-muted">Choose a number to jump to a question.</p>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {run.map((question, index) => {
                const answer = answers[question.id] ?? blankAnswer();
                const hasAnswer = question.type === "mcq" ? answer.choice !== null : answer.numeric.trim() !== "";
                let style = "border-line bg-bg text-muted";
                if (answer.review) style = "border-accent bg-accent/10 text-fg";
                else if (hasAnswer) style = "border-line bg-raised text-fg";
                if (index === currentIndex) style += " outline outline-2 outline-accent";
                return (
                  <button
                    type="button"
                    key={question.id}
                    onClick={() => setCurrentIndex(index)}
                    aria-label={"Go to question " + (index + 1)}
                    className={"min-h-10 rounded-lg border text-xs font-semibold tabular-nums " + style}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 space-y-1 border-t border-line pt-3 text-xs text-muted">
              <p>Answered: {attempted} / {run.length}</p>
              <p>Review marks: {marked}</p>
            </div>
            {!submitted ? (
              <button
                type="button"
                onClick={submit}
                className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-raised px-4 text-sm font-semibold text-fg"
              >
                <Send className="size-4" /> Submit test
              </button>
            ) : (
              <button
                type="button"
                onClick={reset}
                className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-raised px-4 text-sm font-semibold text-fg"
              >
                <RotateCcw className="size-4" /> Build another
              </button>
            )}
          </aside>
        </div>
      </section>
    );
  }

  const fullReady = SUBJECTS.every(
    ({ id }) => bankCounts[id].mcq >= 20 && bankCounts[id].numerical >= 5,
  );

  return (
    <section className="mt-4 space-y-4 animate-in fade-in duration-200">
      <div className={outer}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">PYQ powered</p>
            <h2 className="mt-1 text-lg font-semibold text-fg">JEE Main Test Generator</h2>
            <p className="mt-1 text-xs text-muted">Generate timed tests from questions in your vault.</p>
          </div>
          <span className="rounded-lg bg-raised px-2.5 py-1 text-xs font-medium text-accent">
            {questionBank.length} usable PYQs
          </span>
        </div>

        {loadError ? (
          <p className="mt-4 rounded-xl border border-line bg-bg p-3 text-sm text-muted">{loadError}</p>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setMode("jee-main");
              setConfigError(null);
            }}
            className={
              "rounded-xl border p-4 text-left " +
              (mode === "jee-main" ? "border-accent bg-accent/10" : "border-line bg-bg")
            }
          >
            <span className="block font-semibold text-fg">JEE Main Paper 1</span>
            <span className="mt-1 block text-xs text-muted">75 questions · 3 hours · 300 marks</span>
            <span className="mt-2 block text-xs text-muted">Per subject: 20 MCQs + 5 numerical questions</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("custom");
              setConfigError(null);
            }}
            className={
              "rounded-xl border p-4 text-left " +
              (mode === "custom" ? "border-accent bg-accent/10" : "border-line bg-bg")
            }
          >
            <span className="block font-semibold text-fg">Custom PYQ test</span>
            <span className="mt-1 block text-xs text-muted">Choose subject, chapter, question count, and time.</span>
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-line bg-bg p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">Available keyed questions</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {SUBJECTS.map(({ id, name }) => {
                  const counts = bankCounts[id];
                  const ready = counts.mcq >= 20 && counts.numerical >= 5;
                  return (
                    <div key={id} className="rounded-lg border border-line bg-surface px-3 py-2">
                      <p className="text-xs font-semibold text-fg">{name}</p>
                      <p className="mt-1 text-xs text-muted">{counts.mcq} MCQ · {counts.numerical} numerical</p>
                      <p className="mt-1 text-[11px] text-muted">
                        {ready ? "Full-paper quota ready" : "More questions needed for full-paper quota"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {!fullReady ? (
            <p className="mt-3 text-xs text-muted">
              A full paper requires 20 MCQs and 5 numerical PYQs with answer keys in each subject. Use Custom PYQ test with your current bank.
            </p>
          ) : null}
        </div>

        {mode === "custom" ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-muted">
              Subject
              <select
                value={subjectFilter}
                onChange={(event) => {
                  setSubjectFilter(event.target.value as SubjectFilter);
                  setChapterFilter("all");
                  setConfigError(null);
                }}
                className="mt-1 min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-base text-fg"
              >
                <option value="all">All subjects</option>
                {SUBJECTS.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-muted">
              Chapter
              <select
                value={chapterFilter}
                onChange={(event) => {
                  setChapterFilter(event.target.value);
                  setConfigError(null);
                }}
                className="mt-1 min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-base text-fg"
              >
                <option value="all">All available chapters</option>
                {chapterOptions.map((chapter) => (
                  <option key={chapter.value} value={chapter.value}>
                    {subjectFilter === "all" ? chapter.subject + " · " : ""}{chapter.chapter} ({chapter.count})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-muted">
              Questions
              <input
                type="number"
                min="1"
                max="200"
                value={questionCount}
                onChange={(event) =>
                  setQuestionCount(Math.max(1, Math.min(200, Number(event.target.value) || 1)))
                }
                className="mt-1 min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-base text-fg"
              />
            </label>
            <label className="text-xs font-medium text-muted">
              Time limit
              <select
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(Number(event.target.value))}
                className="mt-1 min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-base text-fg"
              >
                {[15, 30, 45, 60, 90, 120, 180].map((minutes) => (
                  <option key={minutes} value={minutes}>{minutes} minutes</option>
                ))}
              </select>
            </label>
            <p className="text-xs text-muted sm:col-span-2">
              {customPool.length} usable PYQs match this selection. Questions are shuffled for each test.
            </p>
          </div>
        ) : null}

        {configError ? (
          <p role="alert" className="mt-4 rounded-xl border border-line bg-bg p-3 text-sm text-muted">
            {configError}
          </p>
        ) : null}

        <button
          type="button"
          disabled={mode === "jee-main" ? !fullReady : customPool.length < questionCount}
          onClick={generate}
          className={button + " mt-4 w-full sm:w-auto"}
        >
          Generate {mode === "jee-main" ? "JEE Main paper" : "custom test"}
        </button>
      </div>
    </section>
  );
}

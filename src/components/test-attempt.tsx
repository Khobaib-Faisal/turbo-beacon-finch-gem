import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Check, CheckCircle2, Clock3, Eye, Flag, X, XCircle } from "lucide-react";
import { completeTestAttempt, getTestAttempt, type AttemptAnalysis, type AttemptAnswer, type AttemptQuestion, type TestAttempt } from "@/lib/jee/test-attempts";
import { getPyqQuestionImage } from "@/lib/pyq/api";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SignInPanel, ShellSkeleton } from "@/components/sign-in-panel";
import type { SubjectId } from "@/lib/jee/types";

const SUBJECTS: Array<{ id: SubjectId; name: string }> = [
  { id: "physics", name: "Physics" }, { id: "chemistry", name: "Chemistry" }, { id: "maths", name: "Mathematics" },
];

function clock(seconds: number): string {
  const value = Math.max(0, seconds);
  return [Math.floor(value / 3600), Math.floor((value % 3600) / 60), value % 60]
    .map((part) => String(part).padStart(2, "0")).join(":");
}
function blankAnswer(): AttemptAnswer { return { choice: null, numeric: "", review: false }; }
function attempted(question: AttemptQuestion, answer: AttemptAnswer) {
  return question.type === "mcq" ? answer.choice !== null : answer.numeric.trim() !== "";
}
function answerLabel(question: AttemptQuestion, answer: AttemptAnswer): string {
  if (question.type === "mcq") return answer.choice === null ? "Not answered" : "Option " + String.fromCharCode(65 + answer.choice);
  return answer.numeric.trim() || "Not answered";
}
function keyLabel(question: AttemptQuestion): string {
  return question.type === "mcq" ? "Option " + String.fromCharCode(65 + question.correctAnswer) : String(question.correctAnswer);
}

function OriginalQuestionImage({ question }: { question: AttemptQuestion }) {
  const [url, setUrl] = useState<string | null>(question.imageUrl ?? null);
  useEffect(() => {
    let cancelled = false;
    if (question.imageUrl || !question.hasVisualImage) return;
    getPyqQuestionImage({ data: { id: question.id } }).then((result) => {
      if (!cancelled) setUrl(result.imageUrl);
    }).catch(() => { if (!cancelled) setUrl(null); });
    return () => { cancelled = true; };
  }, [question.id, question.imageUrl, question.hasVisualImage]);
  if (!question.hasVisualImage && !question.imageUrl) return null;
  return url
    ? <img src={url} alt="Original question image with equations and diagram" className="mt-3 max-h-[30rem] w-full rounded-xl border border-line bg-bg object-contain" />
    : <div className="mt-3 rounded-xl border border-dashed border-line p-4 text-center text-xs text-muted">Original question image unavailable.</div>;
}

export function TestAttemptPage({ attemptId }: { attemptId: string }) {
  const { user, isPending } = useCurrentUserState();
  const [attempt, setAttempt] = useState<TestAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, AttemptAnswer>>({});
  const [secondsByQuestion, setSecondsByQuestion] = useState<Record<string, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [analysis, setAnalysis] = useState<AttemptAnalysis | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const submittedRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    getTestAttempt({ data: attemptId }).then((result) => {
      if (cancelled) return;
      if (!result) {
        setLoadError("This test could not be found in your account.");
        return;
      }
      setAttempt(result);
      setAnswers(result.answers ?? {});
      setAnalysis(result.analysis);
      setSecondsLeft(result.analysis ? 0 : result.durationSeconds);
      submittedRef.current = Boolean(result.submittedAt);
    }).catch((error: unknown) => {
      if (!cancelled) setLoadError(error instanceof Error ? error.message : "Could not open this test.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [attemptId, user]);

  const questions = attempt?.questions ?? [];
  const active = questions[currentIndex] ?? null;
  const activeAnswer = active ? answers[active.id] ?? blankAnswer() : blankAnswer();
  const complete = Boolean(analysis);

  async function finishTest(auto = false) {
    if (!attempt || analysis || submitting || submittedRef.current) return;
    if (!auto && !window.confirm("Submit this test now? You can review every answer and solution afterward.")) return;
    setSubmitting(true);
    submittedRef.current = true;
    try {
      const result = await completeTestAttempt({
        data: {
          id: attempt.id,
          answers,
          secondsByQuestion,
          elapsedSeconds: attempt.durationSeconds - secondsLeft,
        },
      });
      setAnalysis(result);
      setAttempt((current) => current ? { ...current, answers, analysis: result, submittedAt: new Date().toISOString() } : current);
    } catch (error) {
      submittedRef.current = false;
      setLoadError(error instanceof Error ? error.message : "Could not save your test analysis.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!attempt || complete || loading || submitting || secondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => Math.max(0, value - 1));
      if (active) setSecondsByQuestion((current) => ({ ...current, [active.id]: (current[active.id] ?? 0) + 1 }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [attempt, complete, loading, submitting, secondsLeft, active?.id]);

  useEffect(() => {
    if (attempt && !complete && !loading && secondsLeft === 0) void finishTest(true);
  }, [attempt, complete, loading, secondsLeft]);

  useEffect(() => {
    if (!attempt || complete) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [attempt, complete]);

  const answeredCount = useMemo(
    () => questions.filter((question) => attempted(question, answers[question.id] ?? blankAnswer())).length,
    [questions, answers],
  );
  const elapsed = attempt ? attempt.durationSeconds - secondsLeft : 0;
  const outer = "rounded-2xl border border-line bg-surface p-4 sm:p-5";
  const quiet = "min-h-11 rounded-xl border border-line bg-raised px-4 text-sm font-medium text-fg disabled:opacity-40";

  if (isPending || (user && loading)) return <main className="mx-auto max-w-5xl p-4 sm:p-8"><ShellSkeleton /></main>;
  if (!user) return <SignInPanel />;
  if (loadError && !attempt) return <main className="mx-auto max-w-3xl p-6"><section className={outer}><h1 className="text-xl font-semibold text-fg">Test unavailable</h1><p className="mt-2 text-sm text-muted">{loadError}</p><Link to="/" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm text-accent"><ArrowLeft className="size-4" /> Return to your test generator</Link></section></main>;
  if (!attempt) return null;

  if (analysis) {
    const percent = Math.round(100 * analysis.score / Math.max(analysis.maxScore, 1));
    const timeMax = Math.max(...SUBJECTS.map(({ id }) => analysis.subjects[id].seconds), 1);
    return (
      <main className="mx-auto min-h-screen max-w-6xl space-y-4 p-4 sm:p-8">
        <header className={outer + " flex flex-wrap items-center justify-between gap-3"}>
          <div><p className="text-xs uppercase tracking-wider text-muted">Test analysis · {new Date(attempt.submittedAt ?? attempt.createdAt).toLocaleString()}</p><h1 className="mt-1 text-xl font-semibold text-fg">{attempt.title}</h1><p className="mt-1 text-xs text-muted">{attempt.questions.length} questions · time used {clock(analysis.elapsedSeconds)}</p></div>
          <Link to="/" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-raised px-4 text-sm font-medium text-fg"><ArrowLeft className="size-4" /> Back to generator</Link>
        </header>
        <section className={outer}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Score", `${analysis.score} / ${analysis.maxScore}`],
              ["Correct", String(analysis.correct)],
              ["Wrong", String(analysis.incorrect)],
              ["Unanswered", String(analysis.unanswered)],
            ].map(([label, value]) => <div key={label} className="rounded-xl border border-line bg-bg p-3"><p className="text-xs text-muted">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-fg">{value}</p></div>)}
          </div>
          <div className="mt-3 rounded-xl border border-line bg-bg p-3">
            <div className="flex justify-between gap-2 text-xs"><span className="font-semibold text-fg">Paper score</span><span className="text-muted">{percent}%</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full bg-accent" style={{ width: Math.max(0, Math.min(100, percent)) + "%" }} /></div>
          </div>
        </section>

        <section className={outer}>
          <div className="flex items-center gap-2"><Clock3 className="size-4 text-muted" /><h2 className="font-semibold text-fg">Time distribution by subject</h2></div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {SUBJECTS.map(({ id, name }) => {
              const item = analysis.subjects[id];
              return <div key={id} className="rounded-xl border border-line bg-bg p-3">
                <div className="flex justify-between gap-3 text-sm"><span className="font-semibold text-fg">{name}</span><span className="font-mono text-xs text-muted">{clock(item.seconds)}</span></div>
                <div className="mt-2 h-2 rounded-full bg-raised"><div className="h-full rounded-full bg-accent" style={{ width: Math.round(item.seconds / timeMax * 100) + "%" }} /></div>
                <p className="mt-2 text-xs text-muted">{item.correct}/{item.total} right · {item.incorrect} wrong · {item.unanswered} unanswered</p>
              </div>;
            })}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-lg font-semibold text-fg">Question-by-question analysis</h2><p className="text-xs text-muted">Your response, correct answer, time spent, and solution for each PYQ.</p></div><p className="text-xs text-muted">{analysis.questions.length} questions</p></div>
          {analysis.questions.map((question, index) => {
            const correct = question.isCorrect === true;
            const unanswered = question.isCorrect === null;
            const showSolution = expanded[question.id] ?? false;
            return <article key={question.id + "-" + index} className={outer}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className={"flex size-8 shrink-0 items-center justify-center rounded-full " + (correct ? "bg-emerald-500/15 text-emerald-400" : unanswered ? "bg-raised text-muted" : "bg-red-500/15 text-red-400")}>
                    {correct ? <CheckCircle2 className="size-4" /> : unanswered ? <Eye className="size-4" /> : <XCircle className="size-4" />}
                  </span>
                  <div><p className="font-semibold text-fg">Question {index + 1} <span className="ml-2 text-xs font-normal text-muted">{SUBJECTS.find((subject) => subject.id === question.subject)?.name} · {question.chapter}</span></p>
                    <p className="mt-1 text-xs text-muted">{correct ? "Correct · +4 marks" : unanswered ? "Not attempted · 0 marks" : "Incorrect · −1 mark"} · {clock(question.secondsSpent)} spent {question.answerVerified === false ? "· answer key unverified" : ""}</p></div>
                </div>
                <button type="button" onClick={() => setExpanded((current) => ({ ...current, [question.id]: !showSolution }))} className={quiet + " min-h-10"}>{showSolution ? "Hide solution" : "View solution"}</button>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-fg">{question.question}</p>
              <OriginalQuestionImage question={question} />
              {question.type === "mcq" && question.options?.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{question.options.map((option, optionIndex) => {
                const selected = question.answer.choice === optionIndex;
                const key = question.correctAnswer === optionIndex;
                return <div key={optionIndex} className={"rounded-lg border px-3 py-2 text-sm " + (key ? "border-accent bg-accent/10 text-fg" : selected ? "border-red-400/60 bg-red-400/10 text-fg" : "border-line bg-bg text-muted")}>
                  <span className="mr-2 font-semibold">{String.fromCharCode(65 + optionIndex)}.</span>{option}{selected ? <span className="ml-2 text-xs">(your answer)</span> : null}{key ? <span className="ml-2 text-xs">(correct)</span> : null}
                </div>;
              })}</div> : <p className="mt-3 text-sm text-muted">Your answer: {answerLabel(question, question.answer)} · Correct answer: {keyLabel(question)}</p>}
              {showSolution ? <div className="mt-3 rounded-xl border border-line bg-bg p-4"><p className="text-sm font-semibold text-fg">Solution</p><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">{question.explanation || "No written solution is available for this PYQ yet."}</p></div> : null}
            </article>;
          })}
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-4 p-4 sm:p-8">
      <header className={outer + " flex flex-wrap items-center justify-between gap-3"}>
        <div><p className="text-xs uppercase tracking-wider text-muted">{attempt.mode === "jee-main" ? "JEE Main Paper 1 · 2026 pattern" : "Custom PYQ test"}</p><h1 className="mt-1 text-xl font-semibold text-fg">{attempt.title}</h1><p className="mt-1 text-xs text-muted">+4 correct · −1 incorrect · unanswered 0 · {answeredCount}/{questions.length} answered</p></div>
        <div aria-live="polite" className={"flex items-center gap-2 rounded-xl border px-3 py-2 font-mono text-lg tabular-nums " + (secondsLeft <= 300 ? "border-accent bg-accent/10 text-accent" : "border-line bg-bg text-fg")}><Clock3 className="size-4" />{clock(secondsLeft)}</div>
      </header>
      {loadError ? <p role="alert" className="rounded-xl border border-line bg-bg p-3 text-sm text-muted">{loadError}</p> : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_270px]">
        <section className={outer}>
          {active ? <>
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line pb-3">
              <div><p className="text-xs text-muted">{SUBJECTS.find((subject) => subject.id === active.subject)?.name} · {active.chapter} · {clock(secondsByQuestion[active.id] ?? 0)} on this question</p><h2 className="mt-1 font-semibold text-fg">Question {currentIndex + 1}<span className="ml-2 text-xs font-normal text-muted">{active.type === "mcq" ? "Multiple choice" : "Numerical answer"}</span></h2></div>
              <button type="button" onClick={() => setAnswers((current) => ({ ...current, [active.id]: { ...activeAnswer, review: !activeAnswer.review } }))} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-bg px-3 text-xs text-fg"><Flag className="size-3.5" />{activeAnswer.review ? "Marked for review" : "Mark for review"}</button>
            </div>
            {active.hasVisualImage || active.visualQuestion || active.imageUrl ? <OriginalQuestionImage question={active} /> : <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-fg">{active.question}</p>}
            {active.type === "mcq" ? <div className="mt-5 grid gap-2">{(active.options?.length ? active.options : ["A", "B", "C", "D"]).map((option, index) => {
              const selected = activeAnswer.choice === index;
              return <button type="button" key={index} onClick={() => setAnswers((current) => ({ ...current, [active.id]: { ...activeAnswer, choice: index } }))}
                className={"flex min-h-12 items-center gap-3 rounded-xl border px-3 text-left text-sm " + (selected ? "border-accent bg-accent/10 text-fg" : "border-line bg-bg text-fg hover:border-muted")}>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line text-xs font-semibold">{String.fromCharCode(65 + index)}</span>
                {active.hasVisualImage || active.visualQuestion ? null : <span>{option}</span>}
                {selected ? <Check className="ml-auto size-4" /> : null}
              </button>;
            })}</div> : <label className="mt-5 block max-w-sm text-xs font-medium text-muted">Numerical answer<input type="number" step="1" inputMode="numeric" value={activeAnswer.numeric} onChange={(event) => setAnswers((current) => ({ ...current, [active.id]: { ...activeAnswer, numeric: event.target.value } }))} placeholder="Enter an integer" className="mt-1 min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-base text-fg" /></label>}
            <div className="mt-5 flex items-center justify-between gap-2 border-t border-line pt-4"><button type="button" disabled={currentIndex === 0} onClick={() => setCurrentIndex((index) => index - 1)} className={quiet}>Previous</button>{currentIndex < questions.length - 1 ? <button type="button" onClick={() => setCurrentIndex((index) => index + 1)} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink">Save & Next</button> : <button type="button" onClick={() => void finishTest()} disabled={submitting} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-50">{submitting ? "Saving analysis…" : "Submit test"}</button>}</div>
          </> : null}
        </section>
        <aside className={outer}>
          <h2 className="font-semibold text-fg">Question palette</h2><p className="mt-1 text-xs text-muted">Tap any number to move between questions.</p>
          <div className="mt-4 grid grid-cols-5 gap-2">{questions.map((question, index) => {
            const answer = answers[question.id] ?? blankAnswer();
            const hasAnswer = attempted(question, answer);
            const style = (index === currentIndex ? "outline outline-2 outline-accent " : "") + (answer.review ? "border-accent bg-accent/10 text-fg" : hasAnswer ? "border-line bg-raised text-fg" : "border-line bg-bg text-muted");
            return <button type="button" key={question.id + index} onClick={() => setCurrentIndex(index)} aria-label={"Go to question " + (index + 1)} className={"min-h-10 rounded-lg border text-xs font-semibold " + style}>{index + 1}</button>;
          })}</div>
          <div className="mt-4 space-y-1 border-t border-line pt-3 text-xs text-muted"><p>Answered: {answeredCount} / {questions.length}</p><p>Current question time: {active ? clock(secondsByQuestion[active.id] ?? 0) : "00:00:00"}</p><p>Time elapsed: {clock(elapsed)}</p></div>
          <button type="button" onClick={() => void finishTest()} disabled={submitting} className="mt-4 w-full min-h-11 rounded-xl border border-line bg-raised px-4 text-sm font-semibold text-fg disabled:opacity-50">{submitting ? "Saving…" : "Submit test"}</button>
        </aside>
      </div>
    </main>
  );
}

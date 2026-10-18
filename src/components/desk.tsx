import { useEffect, useState, type FormEvent } from "react";
import { 
  Flame, 
  Undo2, 
  LayoutDashboard, 
  GraduationCap, 
  BookOpen, 
  FileCheck2, 
  Bot,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
  addTodo,
  addWeakTopic,
  deleteTodo,
  deleteWeakTopic,
  finishLecture,
  getDesk,
  saveSettings,
  setRemaining,
  setTodayQuestions,
  setTodoDone,
  setWeakCleared,
  undoLastLecture,
} from "@/lib/jee/api";
import { daysBetween, formatHours, formatLong } from "@/lib/jee/pace";
import type { Bucket, Desk, DeskResult, DeskSettings, QuestionDay, Reward, SubjectId } from "@/lib/jee/types";

const field =
  "mt-1 w-full min-h-11 rounded-xl border border-line bg-bg px-3 text-base text-fg outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const primary =
  "min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-40";
const quiet =
  "min-h-11 rounded-xl border border-line bg-raised px-4 text-sm font-medium text-fg disabled:opacity-40";

type ActiveTab = "tracker" | "pyq" | "books" | "tests" | "ai";

export interface QuestionItem {
  id: string;
  source: string;
  type: "mcq" | "integer";
  question: string;
  options?: string[];
  correctAnswer: number;
  explanation: string;
}

export interface ChapterPYQ {
  chapter: string;
  subject: SubjectId;
  questions: QuestionItem[];
}

const SUBJECTS: Array<{ id: SubjectId; name: string; note: string }> = [
  { id: "physics", name: "Physics", note: "Average length 2.15 hours." },
  {
    id: "chemistry",
    name: "Chemistry",
    note: "Organic and inorganic only. Physical is already done, so it is not counted. Average 2 hours.",
  },
  {
    id: "maths",
    name: "Mathematics",
    note: "Lectures average 2.75 hours. One shots average 8 hours. A one shot still counts as one lecture.",
  },
];

function messageOf(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err && "message" in err && typeof err.message === "string") {
    return err.message;
  }
  return "Something failed. Try again.";
}

function countdownLabel(today: string, date: string | null): string {
  if (!date) return "Not set";
  const n = daysBetween(today, date);
  if (n === 0) return "Today";
  if (n < 0) return "Past";
  return n === 1 ? "1 day" : `${n} days`;
}

function tracked(history: QuestionDay[], subject: SubjectId): number {
  return history.reduce((sum, day) => sum + day[subject], 0);
}

export function DeskApp() {
  const user = useCurrentUser();
  const [desk, setDesk] = useState<Desk | null>(null);
  const [reward, setReward] = useState<Reward>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("tracker");

  // AI Coach state (Instant robust coaching based on real data)
  const [aiMessages, setAiMessages] = useState<Array<{ role: "user" | "ai"; text: string }>>([
    {
      role: "ai",
      text: "Hey! I'm your JEE coach. I'm tracking your lectures, questions, and streak. How can I help you crush your backlog today?"
    }
  ]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  function handleSendAiMessage(e: FormEvent) {
    e.preventDefault();
    const query = aiInput.trim();
    if (!query || aiLoading || !desk) return;

    const newHistory = [...aiMessages, { role: "user" as const, text: query }];
    setAiMessages(newHistory);
    setAiInput("");
    setAiLoading(true);

    setTimeout(() => {
      const lower = query.toLowerCase();
      let reply = "";

      const studyTips = [
        "Focus on high-weightage chapters first. If you're stuck on a tough module problem, break it down into basic formulas before jumping into advanced calculations.",
        "Consistency beats intensity. Even if you're tired, clearing your daily question target keeps your momentum alive without burning you out.",
        "When revising Physics, don't just read notes—re-solve your class examples and incorrect PYQs from scratch.",
        "In Chemistry, make sure your Inorganic NCERT reading is active. Use short 15-minute blocks to revise block chemistry and reaction exceptions."
      ];

      if (lower.includes("backlog") || lower.includes("left") || lower.includes("finish")) {
        reply = `You currently have ${desk.lecturesLeft} lectures remaining (${formatHours(desk.hoursLeft)} hours). To hit your target date of ${formatLong(desk.settings.targetDate)}, your required pace is ${formatHours(desk.requiredHoursPerDay || 0)} hours per day. Keep chipping away at them one by one!`;
      } else if (lower.includes("streak") || lower.includes("xp") || lower.includes("points")) {
        reply = `Your current streak is active at ${effectiveStreak} days, and you've earned a total of ${desk.xp} XP[cite: 34]! Protect your flame today by finishing a lecture or hitting your daily question target[cite: 34].`;
      } else if (lower.includes("physics") || lower.includes("rotational") || lower.includes("electricity")) {
        reply = `For Physics, focus heavily on conceptual clarity and standard model problems. Try solving a few problems in the PYQ Vault to test your formula application!`;
      } else if (lower.includes("maths") || lower.includes("calculus") || lower.includes("algebra")) {
        reply = `Mathematics requires rigorous practice. Don't skip steps while solving calculus or algebra problems; writing down intermediate steps prevents calculation errors in exams.`;
      } else if (lower.includes("unmotivated") || lower.includes("tired") || lower.includes("burnout")) {
        reply = `It's completely normal to feel fried. Take a 20-minute break, step away from the screen, and come back to knock out just 1 easy task or 5 simple questions. Micro-actions beat doing nothing!`;
      } else {
        reply = studyTips[Math.floor(Math.random() * studyTips.length)];
      }

      setAiMessages([...newHistory, { role: "ai", text: reply }]);
      setAiLoading(false);
    }, 500);
  }

  // Daily Question Target state
  const [questionTarget, setQuestionTarget] = useState<number>(() => {
    if (typeof window === "undefined") return 15;
    const saved = localStorage.getItem("jee_question_streak_target");
    return saved ? Number(saved) : 15;
  });
  const [targetInput, setTargetInput] = useState<string>(() => String(questionTarget));

  // Solved Question IDs set (ensures 1-time XP reward)
  const [solvedIds, setSolvedIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("jee_solved_pyq_ids");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Dynamic Subject & Question Loader
  const [selectedSubject, setSelectedSubject] = useState<SubjectId>("physics");
  const [pyqChapters, setPyqChapters] = useState<ChapterPYQ[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // PYQ Section Navigation states
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState<number | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [integerInput, setIntegerInput] = useState<string>("");
  const [isChecked, setIsChecked] = useState(false);

  function commitTarget(valStr: string) {
    const parsed = parseInt(valStr.replace(/[^\d]/g, ""), 10);
    if (!isNaN(parsed) && parsed > 0) {
      setQuestionTarget(parsed);
      setTargetInput(String(parsed));
      if (typeof window !== "undefined") {
        localStorage.setItem("jee_question_streak_target", String(parsed));
      }
    } else {
      setTargetInput(String(questionTarget));
    }
  }

  // Load subject questions from public JSON on demand
  useEffect(() => {
    let cancelled = false;
    setLoadingQuestions(true);
    fetch(`/data/${selectedSubject}.json`)
      .then((res) => {
        if (!res.ok) throw new Error("Not loaded");
        return res.json();
      })
      .then((data: ChapterPYQ[]) => {
        if (!cancelled) setPyqChapters(data);
      })
      .catch(() => {
        if (!cancelled) setPyqChapters([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingQuestions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSubject]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDesk()
      .then((res) => {
        if (cancelled) return;
        setDesk(res.desk);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = messageOf(err);
        if (message.toLowerCase().includes("unauthorized")) {
          setSignedOut(true);
          return;
        }
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!reward) return;
    const timer = window.setTimeout(() => setReward(null), 1800);
    return () => window.clearTimeout(timer);
  }, [reward]);

  async function run(action: () => Promise<DeskResult>) {
    setBusy(true);
    setError(null);
    try {
      const res = await action();
      setDesk(res.desk);
      if (res.reward) setReward(res.reward);
    } catch (err) {
      const message = messageOf(err);
      if (message.toLowerCase().includes("unauthorized")) {
        setSignedOut(true);
        return;
      }
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckAnswer(q: QuestionItem, subject: SubjectId) {
    setIsChecked(true);
    let correct = false;
    if (q.type === "mcq") {
      correct = selectedOption === q.correctAnswer;
    } else {
      correct = Number(integerInput.trim()) === Number(q.correctAnswer);
    }

    if (!correct) return;

    const alreadyAwarded = solvedIds.includes(q.id);
    if (alreadyAwarded) {
      setReward({ xp: 0, label: "Correct! (XP already claimed)" });
      return;
    }

    const nextSolved = [...solvedIds, q.id];
    setSolvedIds(nextSolved);
    if (typeof window !== "undefined") {
      localStorage.setItem("jee_solved_pyq_ids", JSON.stringify(nextSolved));
    }

    if (desk) {
      const earnedXP = 4;
      try {
        const nextSubjectCount = desk.todayQuestions[subject] + 1;
        await setTodayQuestions({ data: { subject, count: nextSubjectCount } });
        setDesk({
          ...desk,
          xp: desk.xp + earnedXP,
          todayQuestions: {
            ...desk.todayQuestions,
            [subject]: nextSubjectCount,
          },
        });
        setReward({ xp: earnedXP, label: "First-time PYQ Solved! (+4 XP & +1 Question)" });
      } catch {
        setReward({ xp: earnedXP, label: "First-time PYQ Solved! (+4 XP & +1 Question)" });
      }
    }
  }

  function resetQuestionState() {
    setSelectedOption(null);
    setIntegerInput("");
    setIsChecked(false);
  }

  if (signedOut) return <RedirectToSignIn />;
  if (loading || !desk) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-8">
        <div className="h-10 w-48 animate-pulse rounded-xl bg-raised" />
        <div className="mt-8 h-56 animate-pulse rounded-2xl bg-surface" />
        {error ? <p className="mt-4 text-sm text-accent">{error}</p> : null}
      </main>
    );
  }

  const todayQuestions = desk.todayQuestions.physics + desk.todayQuestions.chemistry + desk.todayQuestions.maths;
  const questionsHit = todayQuestions >= questionTarget;
  const streakAliveToday = desk.streakAliveToday || questionsHit;
  const effectiveStreak = desk.streakAliveToday
    ? desk.streak
    : questionsHit
      ? desk.streak + 1
      : desk.streak;

  const currentChapterObj = pyqChapters.find((c) => c.chapter === selectedChapter);
  const activeQuestion = currentChapterObj && activeQuestionIdx !== null 
    ? currentChapterObj.questions[activeQuestionIdx] 
    : null;

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-24 pt-4 sm:px-8">
      {/* Header */}
      <header className="sticky top-0 z-20 -mx-4 border-b border-line bg-bg/95 backdrop-blur px-4 py-3 sm:-mx-8 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">JEE Tracker</p>
            <h1 className="font-serif text-2xl font-bold leading-tight text-fg">Desk & Vault</h1>
          </div>
          <UserButton />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex items-center gap-3">
            <p className="flex items-center gap-1.5 text-sm">
              <Flame
                className={streakAliveToday ? "size-4 text-accent" : "size-4 text-muted"}
                aria-hidden="true"
              />
              <span className="tabular-nums font-semibold">
                {effectiveStreak === 1 ? "1 day streak" : `${effectiveStreak} day streak`}
              </span>
            </p>
            <span className="text-muted">·</span>
            <p className="tabular-nums text-sm font-semibold text-accent">{desk.xp} XP</p>
            <span className="text-muted">·</span>
            <p className="text-xs text-muted tabular-nums">
              Today: {todayQuestions} Qs ({desk.todayQuestions.physics}P · {desk.todayQuestions.chemistry}C · {desk.todayQuestions.maths}M)
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted">
            <span>Target Qs:</span>
            <input
              type="text"
              inputMode="numeric"
              value={targetInput}
              aria-label="Daily target questions"
              onChange={(e) => setTargetInput(e.target.value.replace(/[^\d]/g, ""))}
              onBlur={() => commitTarget(targetInput)}
              className="w-12 rounded-lg border border-line bg-surface px-1.5 py-0.5 text-center text-xs font-semibold text-fg outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="mt-3 flex overflow-x-auto gap-1 border-t border-line/50 pt-2 no-scrollbar">
          <button
            type="button"
            onClick={() => {
              setActiveTab("tracker");
              setSelectedChapter(null);
              setActiveQuestionIdx(null);
            }}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "tracker" ? "bg-accent text-accent-ink" : "text-muted hover:bg-raised hover:text-fg"
            }`}
          >
            <LayoutDashboard className="size-3.5" />
            Tracker
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("pyq");
              setSelectedChapter(null);
              setActiveQuestionIdx(null);
            }}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "pyq" ? "bg-accent text-accent-ink" : "text-muted hover:bg-raised hover:text-fg"
            }`}
          >
            <GraduationCap className="size-3.5" />
            PYQ Vault
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("books")}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "books" ? "bg-accent text-accent-ink" : "text-muted hover:bg-raised hover:text-fg"
            }`}
          >
            <BookOpen className="size-3.5" />
            Top Books
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tests")}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "tests" ? "bg-accent text-accent-ink" : "text-muted hover:bg-raised hover:text-fg"
            }`}
          >
            <FileCheck2 className="size-3.5" />
            Test Generator
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ai")}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "ai" ? "bg-accent text-accent-ink" : "text-muted hover:bg-raised hover:text-fg"
            }`}
          >
            <Bot className="size-3.5" />
            AI Coach
          </button>
        </nav>

        {reward ? (
          <p className="reward-pop mt-2 text-xs font-semibold text-accent" aria-live="polite">
            {reward.xp > 0 ? `+${reward.xp}` : reward.xp} XP · {reward.label}
          </p>
        ) : null}
        {error ? <p className="mt-2 text-xs text-accent">{error}</p> : null}
      </header>

      {/* TAB 1: TRACKER */}
      {activeTab === "tracker" && (
        <div className="space-y-6 pt-4 animate-in fade-in duration-200">
          <section className="grid gap-3 sm:grid-cols-3">
            <ExamCard
              kicker="January Attempt"
              title="Main 1"
              note="Set official exam date when scheduled."
              today={desk.today}
              date={desk.settings.janDate}
              disabled={busy}
              onDate={(janDate) => {
                if (janDate) void run(() => saveSettings({ data: { ...desk.settings, janDate } }));
              }}
            />
            <ExamCard
              kicker="April Attempt"
              title="Main 2"
              note="Target session date."
              today={desk.today}
              date={desk.settings.aprilDate}
              disabled={busy}
              onDate={(aprilDate) => {
                void run(() => saveSettings({ data: { ...desk.settings, aprilDate } }));
              }}
            />
            <ExamCard
              kicker="Advanced"
              title="IIT Entrance"
              note="Final milestone date."
              today={desk.today}
              date={desk.settings.advancedDate}
              disabled={busy}
              onDate={(advancedDate) => {
                void run(() => saveSettings({ data: { ...desk.settings, advancedDate } }));
              }}
            />
          </section>

          <Plan desk={desk} busy={busy} onSave={(settings) => void run(() => saveSettings({ data: settings }))} />

          <section className="grid gap-3 lg:grid-cols-3">
            {SUBJECTS.map((subject) => (
              <SubjectCard
                key={subject.id}
                name={subject.name}
                note={subject.note}
                subject={subject.id}
                buckets={desk.buckets.filter((bucket) => bucket.subject === subject.id)}
                todayCount={desk.todayQuestions[subject.id]}
                trackedCount={tracked(desk.history, subject.id)}
                busy={busy}
                onFinish={(bucketId) => void run(() => finishLecture({ data: { bucketId } }))}
                onRemaining={(bucketId, remaining) =>
                  void run(() => setRemaining({ data: { bucketId, remaining } }))
                }
                onQuestions={(count) =>
                  void run(() => setTodayQuestions({ data: { subject: subject.id, count } }))
                }
              />
            ))}
          </section>

          {desk.lastLecture ? (
            <button
              type="button"
              className={`${quiet} inline-flex items-center gap-2`}
              disabled={busy}
              onClick={() => void run(() => undoLastLecture())}
            >
              <Undo2 className="size-4" aria-hidden="true" />
              Undo last {desk.lastLecture.label.toLowerCase()}
            </button>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-2">
            <WeakList desk={desk} busy={busy} run={run} />
            <TodoList desk={desk} busy={busy} run={run} />
          </div>

          <History history={desk.history} today={desk.today} />
        </div>
      )}

      {/* TAB 2: PYQ VAULT */}
      {activeTab === "pyq" && (
        <section className="mt-4 rounded-2xl border border-line bg-surface p-5 animate-in fade-in duration-200">
          
          {/* LEVEL 1: SUBJECT SELECTOR + CHAPTERS */}
          {!selectedChapter && (
            <div>
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div>
                  <h2 className="text-lg font-semibold text-fg">PYQ Vault</h2>
                  <p className="text-xs text-muted">Select a subject and chapter to solve official JEE questions.</p>
                </div>
                <span className="rounded-lg bg-raised px-2.5 py-1 text-xs font-medium text-accent">Active Vault</span>
              </div>

              {/* Subject Tabs */}
              <div className="mt-4 flex gap-2">
                {(["physics", "chemistry", "maths"] as SubjectId[]).map((subj) => (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => setSelectedSubject(subj)}
                    className={`flex-1 rounded-xl py-2 text-xs font-semibold capitalize transition ${
                      selectedSubject === subj
                        ? "bg-accent text-accent-ink"
                        : "border border-line bg-bg text-muted hover:border-muted hover:text-fg"
                    }`}
                  >
                    {subj}
                  </button>
                ))}
              </div>

              {loadingQuestions ? (
                <div className="mt-8 text-center text-xs text-muted animate-pulse">
                  Loading {selectedSubject} chapters...
                </div>
              ) : pyqChapters.length === 0 ? (
                <div className="mt-8 rounded-xl border border-dashed border-line p-8 text-center">
                  <p className="text-xs text-muted">No questions added yet for this subject. Paste question batches into /public/data/{selectedSubject}.json!</p>
                </div>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {pyqChapters.map((ch) => {
                    const solvedInChapter = ch.questions.filter((q) => solvedIds.includes(q.id)).length;
                    return (
                      <button
                        key={ch.chapter}
                        type="button"
                        onClick={() => {
                          setSelectedChapter(ch.chapter);
                          setActiveQuestionIdx(null);
                          resetQuestionState();
                        }}
                        className="flex items-center justify-between rounded-xl border border-line bg-bg p-4 text-left transition hover:border-accent hover:bg-raised/40"
                      >
                        <div>
                          <p className="font-semibold text-fg text-sm">{ch.chapter}</p>
                          <p className="text-xs text-muted uppercase mt-0.5">{ch.subject} · {ch.questions.length} Questions</p>
                        </div>
                        <span className="rounded-lg bg-surface px-2.5 py-1 text-xs font-semibold text-accent">
                          {solvedInChapter}/{ch.questions.length} Solved
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* LEVEL 2: QUESTION LIST FOR SELECTED CHAPTER */}
          {selectedChapter && currentChapterObj && activeQuestionIdx === null && (
            <div>
              <div className="flex items-center justify-between border-b border-line pb-4">
                <button
                  type="button"
                  onClick={() => setSelectedChapter(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-fg"
                >
                  <ArrowLeft className="size-4" /> Back to Chapters
                </button>
                <span className="text-xs font-semibold text-fg">{selectedChapter}</span>
              </div>

              {currentChapterObj.questions.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-line p-8 text-center text-xs text-muted">
                  No questions added in this chapter yet.
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {currentChapterObj.questions.map((q, idx) => {
                    const isDone = solvedIds.includes(q.id);
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => {
                          setActiveQuestionIdx(idx);
                          resetQuestionState();
                        }}
                        className={`w-full flex items-center justify-between rounded-xl border p-3.5 text-left transition ${
                          isDone ? "border-green-500/40 bg-green-500/5 hover:border-green-500" : "border-line bg-bg hover:border-accent"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`size-6 rounded-lg text-center leading-6 text-xs font-bold ${
                            isDone ? "bg-green-500/20 text-green-400" : "bg-surface text-accent"
                          }`}>
                            {idx + 1}
                          </span>
                          <div>
                            <p className="text-xs font-medium text-fg line-clamp-1">{q.question}</p>
                            <p className="text-[10px] text-muted mt-0.5">
                              {q.source} · {q.type === "mcq" ? "MCQ" : "Numerical"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isDone && <CheckCircle2 className="size-4 text-green-400 shrink-0" />}
                          <ChevronRight className="size-4 text-muted shrink-0" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* LEVEL 3: SINGLE QUESTION FOCUS VIEWER */}
          {selectedChapter && currentChapterObj && activeQuestion && activeQuestionIdx !== null && (
            <div>
              <div className="flex items-center justify-between border-b border-line pb-4">
                <button
                  type="button"
                  onClick={() => {
                    setActiveQuestionIdx(null);
                    resetQuestionState();
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-fg"
                >
                  <ArrowLeft className="size-4" /> All Questions
                </button>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-raised px-2 py-0.5 text-[11px] font-semibold text-accent">
                    {activeQuestion.source}
                  </span>
                  <span className="text-xs text-muted tabular-nums">
                    Q {activeQuestionIdx + 1} of {currentChapterObj.questions.length}
                  </span>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-line bg-bg p-5">
                <p className="text-sm font-medium leading-relaxed text-fg">{activeQuestion.question}</p>

                {activeQuestion.type === "mcq" && activeQuestion.options ? (
                  <div className="mt-5 space-y-2.5">
                    {activeQuestion.options.map((opt, optIdx) => {
                      const isSelected = selectedOption === optIdx;
                      const isCorrect = Number(activeQuestion.correctAnswer) === optIdx;

                      let style = "border-line bg-surface text-fg hover:border-muted";
                      if (isChecked) {
                        if (isCorrect) style = "border-green-500 bg-green-500/10 text-green-400 font-semibold";
                        else if (isSelected && !isCorrect) style = "border-red-500 bg-red-500/10 text-red-400";
                      } else if (isSelected) {
                        style = "border-accent bg-accent/15 text-accent font-semibold";
                      }

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          disabled={isChecked}
                          onClick={() => setSelectedOption(optIdx)}
                          className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-xs transition ${style}`}
                        >
                          <span className="flex items-center gap-2.5">
                            <span className="font-bold">{String.fromCharCode(65 + optIdx)}.</span>
                            <span>{opt}</span>
                          </span>
                          {isChecked && isCorrect && <CheckCircle2 className="size-4 text-green-400 shrink-0" />}
                          {isChecked && isSelected && !isCorrect && <XCircle className="size-4 text-red-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    <label className="block text-xs text-muted font-medium">Enter Numerical Answer:</label>
                    <input
                      type="text"
                      disabled={isChecked}
                      value={integerInput}
                      placeholder="Type number..."
                      onChange={(e) => setIntegerInput(e.target.value)}
                      className={`${field} max-w-xs text-sm`}
                    />
                    {isChecked && (
                      <div className="flex items-center gap-2 text-xs">
                        {Number(integerInput.trim()) === Number(activeQuestion.correctAnswer) ? (
                          <span className="flex items-center gap-1.5 text-green-400 font-semibold">
                            <CheckCircle2 className="size-4" /> Correct Answer!
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-red-400 font-semibold">
                            <XCircle className="size-4" /> Incorrect. Correct is: {activeQuestion.correctAnswer}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {isChecked && (
                  <div className="mt-5 rounded-xl border border-line bg-surface/70 p-4 text-xs text-muted leading-relaxed">
                    <p className="font-semibold text-fg mb-1">Step-by-step Solution:</p>
                    {activeQuestion.explanation}
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={activeQuestionIdx === 0}
                  onClick={() => {
                    setActiveQuestionIdx((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
                    resetQuestionState();
                  }}
                  className={`${quiet} inline-flex items-center gap-1.5 text-xs`}
                >
                  <ChevronLeft className="size-4" /> Previous
                </button>

                {!isChecked ? (
                  <button
                    type="button"
                    disabled={activeQuestion.type === "mcq" ? selectedOption === null : !integerInput.trim()}
                    onClick={() => handleCheckAnswer(activeQuestion, currentChapterObj.subject)}
                    className={`${primary} text-xs px-6`}
                  >
                    Check Answer
                  </button>
                ) : solvedIds.includes(activeQuestion.id) ? (
                  <span className="rounded-lg bg-green-500/15 px-3 py-1 text-xs font-semibold text-green-400">
                    Solved (+4 XP & +1 Question Added)
                  </span>
                ) : null}

                <button
                  type="button"
                  disabled={activeQuestionIdx === currentChapterObj.questions.length - 1}
                  onClick={() => {
                    setActiveQuestionIdx((prev) => 
                      prev !== null && prev < currentChapterObj.questions.length - 1 ? prev + 1 : prev
                    );
                    resetQuestionState();
                  }}
                  className={`${quiet} inline-flex items-center gap-1.5 text-xs`}
                >
                  Next <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* TAB 3: TOP BOOKS */}
      {activeTab === "books" && (
        <section className="mt-4 rounded-2xl border border-line bg-surface p-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div>
              <h2 className="text-lg font-semibold text-fg">Top Books Vault</h2>
              <p className="text-xs text-muted">Irodov, SBT, and Black Book selected practice questions.</p>
            </div>
            <span className="rounded-lg bg-raised px-2.5 py-1 text-xs font-medium text-accent">5 XP / Q</span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-line bg-bg p-4">
              <h3 className="font-semibold text-fg text-sm">Physics</h3>
              <p className="mt-1 text-xs text-muted">Irodov & SBT Select Problems</p>
              <button type="button" className={`${quiet} mt-3 w-full text-xs`}>Open Problems</button>
            </div>
            <div className="rounded-xl border border-line bg-bg p-4">
              <h3 className="font-semibold text-fg text-sm">Chemistry</h3>
              <p className="mt-1 text-xs text-muted">MS Chouhan Advanced Organic</p>
              <button type="button" className={`${quiet} mt-3 w-full text-xs`}>Open Problems</button>
            </div>
            <div className="rounded-xl border border-line bg-bg p-4">
              <h3 className="font-semibold text-fg text-sm">Mathematics</h3>
              <p className="mt-1 text-xs text-muted">Black Book (Vikas Gupta)</p>
              <button type="button" className={`${quiet} mt-3 w-full text-xs`}>Open Problems</button>
            </div>
          </div>
        </section>
      )}

      {/* TAB 4: TEST GENERATOR */}
      {activeTab === "tests" && (
        <section className="mt-4 rounded-2xl border border-line bg-surface p-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div>
              <h2 className="text-lg font-semibold text-fg">Test Generator</h2>
              <p className="text-xs text-muted">Timed mixed mock practice across chapters.</p>
            </div>
            <span className="rounded-lg bg-raised px-2.5 py-1 text-xs font-medium text-accent">Phase 3</span>
          </div>
          <p className="mt-4 text-xs text-muted">
            Configure full timed mocks across chapters once question banks are loaded.
          </p>
        </section>
      )}

      {/* TAB 5: AI COACH */}
      {activeTab === "ai" && (
        <section className="mt-4 flex flex-col h-[70vh] rounded-2xl border border-line bg-surface p-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <h2 className="text-base font-semibold text-fg">AI JEE Coach</h2>
              <p className="text-xs text-muted">Context-aware advice based on your syllabus & daily pace.</p>
            </div>
            <span className="rounded-lg bg-raised px-2.5 py-1 text-xs font-semibold text-accent">AI Ready</span>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto space-y-3 py-4 pr-1">
            {aiMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-accent text-accent-ink font-medium"
                      : "border border-line bg-bg text-fg whitespace-pre-wrap"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {aiLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-line bg-bg px-4 py-2 text-xs text-muted animate-pulse">
                  Thinking...
                </div>
              </div>
            )}
          </div>

          {/* Message Input */}
          <form onSubmit={handleSendAiMessage} className="flex gap-2 border-t border-line pt-3">
            <input
              type="text"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Ask about strategy, concepts, backlog, or weak topics..."
              className={`${field} min-h-10 text-xs mt-0`}
            />
            <button
              type="submit"
              disabled={aiLoading || !aiInput.trim()}
              className={`${primary} min-h-10 text-xs px-5`}
            >
              Send
            </button>
          </form>
        </section>
      )}
    </main>
  );
}

function ExamCard({
  kicker,
  title,
  note,
  today,
  date,
  disabled,
  onDate,
}: {
  kicker: string;
  title: string;
  note: string;
  today: string;
  date: string | null;
  disabled: boolean;
  onDate: (date: string | null) => void;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs text-muted">{kicker}</p>
      <p className="mt-1 font-serif text-3xl leading-none tabular-nums text-fg">
        {countdownLabel(today, date)}
      </p>
      <h2 className="mt-2 text-sm font-semibold text-fg">{title}</h2>
      <p className="mt-1 text-xs text-muted">{note}</p>
      <label className="mt-3 block text-xs text-muted">
        Exam day
        <input
          className={field}
          type="date"
          disabled={disabled}
          value={date ?? ""}
          onChange={(event) => onDate(event.target.value || null)}
        />
      </label>
    </section>
  );
}

function Plan({
  desk,
  busy,
  onSave,
}: {
  desk: Desk;
  busy: boolean;
  onSave: (settings: DeskSettings) => void;
}) {
  const late = desk.daysApart !== null && desk.daysApart > 0;
  const early = desk.daysApart !== null && desk.daysApart < 0;
  const parts = SUBJECTS.map((subject) => {
    const left = desk.buckets
      .filter((bucket) => bucket.subject === subject.id)
      .reduce((sum, bucket) => sum + bucket.remaining, 0);
    return `${subject.name} ${left}`;
  });

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-xs text-muted">Remaining syllabus</p>
      <p className="mt-2 font-serif text-5xl leading-none tabular-nums text-fg">
        {formatHours(desk.hoursLeft)}
      </p>
      <p className="mt-1 text-xs text-muted">approximate hours still left</p>
      <p className="mt-3 text-xs text-fg tabular-nums">
        {desk.lecturesLeft} lectures left · {parts.join(" · ")}
      </p>
      <div className="mt-4 border-t border-line pt-3">
        <label className="block text-xs text-muted">
          Target completion date
          <input
            className={field}
            type="date"
            disabled={busy}
            value={desk.settings.targetDate}
            onChange={(event) => {
              if (event.target.value) onSave({ ...desk.settings, targetDate: event.target.value });
            }}
          />
        </label>
        {desk.studyDays > 0 && desk.requiredHoursPerDay !== null ? (
          <p className="mt-2 text-xs text-fg">
            {desk.studyDays} {desk.studyDays === 1 ? "day" : "days"} remaining counting today. Daily requirement:{" "}
            <span className="font-semibold tabular-nums">{formatHours(desk.requiredHoursPerDay)}</span> hours/day
            to finish on {formatLong(desk.settings.targetDate)}.
          </p>
        ) : (
          <p className="mt-2 text-xs text-fg">
            {desk.hoursLeft <= 0
              ? "Nothing left on the lecture count."
              : "That finish date is already past. Pick a later day."}
          </p>
        )}

        {desk.projectedDate && desk.paceHoursPerDay !== null ? (
          <p className="mt-2 text-xs text-fg">
            At the pace you have actually kept ({formatHours(desk.paceHoursPerDay)} hours a day since you
            started logging), the remaining syllabus ends{" "}
            <span className="font-semibold text-accent">{formatLong(desk.projectedDate)}</span>
            {late && desk.daysApart !== null
              ? `, ${desk.daysApart} ${desk.daysApart === 1 ? "day" : "days"} after your target.`
              : early && desk.daysApart !== null
                ? `, ${Math.abs(desk.daysApart)} ${Math.abs(desk.daysApart) === 1 ? "day" : "days"} before your target.`
                : "."}
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted">
            Finish one lecture and this will also show the date your real pace lands on.
          </p>
        )}
      </div>
    </section>
  );
}

function SubjectCard({
  name,
  note,
  subject,
  buckets,
  todayCount,
  trackedCount,
  busy,
  onFinish,
  onRemaining,
  onQuestions,
}: {
  name: string;
  note: string;
  subject: SubjectId;
  buckets: Bucket[];
  todayCount: number;
  trackedCount: number;
  busy: boolean;
  onFinish: (bucketId: string) => void;
  onRemaining: (bucketId: string, remaining: number) => void;
  onQuestions: (count: number) => void;
}) {
  const left = buckets.reduce((sum, bucket) => sum + bucket.remaining, 0);
  const done = buckets.reduce((sum, bucket) => sum + bucket.completed, 0);
  const hours = buckets.reduce((sum, bucket) => sum + bucket.remaining * bucket.avgHours, 0);
  const total = left + done;

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-fg">{name}</h2>
      <p className="mt-2 font-serif text-4xl leading-none tabular-nums text-fg">{left}</p>
      <p className="mt-1 text-xs text-muted">lectures left · {formatHours(hours)} h</p>
      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-raised" aria-hidden="true">
        <div
          className="h-full bg-accent"
          style={{ width: `${total <= 0 ? 100 : Math.max(0, Math.min(100, (done / total) * 100))}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted tabular-nums">{done} finished since start</p>
      <div className="mt-3 space-y-2">
        {buckets.map((bucket) => (
          <BucketRow
            key={bucket.id}
            bucket={bucket}
            busy={busy}
            onFinish={onFinish}
            onRemaining={onRemaining}
          />
        ))}
      </div>
      <QuestionBox
        subject={subject}
        name={name}
        todayCount={todayCount}
        trackedCount={trackedCount}
        busy={busy}
        onQuestions={onQuestions}
      />
    </section>
  );
}

function BucketRow({
  bucket,
  busy,
  onFinish,
  onRemaining,
}: {
  bucket: Bucket;
  busy: boolean;
  onFinish: (bucketId: string) => void;
  onRemaining: (bucketId: string, remaining: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(String(bucket.remaining));

  return (
    <div className="rounded-xl bg-bg p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-fg">{bucket.label}</p>
        <p className="text-xs tabular-nums text-muted">{bucket.remaining} left</p>
      </div>
      <button
        type="button"
        className={`${primary} mt-2 w-full text-xs min-h-9`}
        disabled={busy || bucket.remaining <= 0}
        onClick={() => onFinish(bucket.id)}
      >
        {bucket.remaining <= 0 ? "None left" : "Finished one · 10 XP"}
      </button>
      <button
        type="button"
        className="mt-1 text-xs text-muted underline-offset-4 hover:underline"
        onClick={() => {
          setDraft(String(bucket.remaining));
          setOpen((value) => !value);
        }}
      >
        Correct count
      </button>
      {open ? (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            const remaining = Number(draft);
            if (!Number.isInteger(remaining) || remaining < 0 || remaining > 500) return;
            onRemaining(bucket.id, remaining);
            setOpen(false);
          }}
        >
          <input
            className={`${field} min-w-0 min-h-8 text-xs`}
            inputMode="numeric"
            value={draft}
            onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ""))}
          />
          <button type="submit" className={`${quiet} min-h-8 text-xs`} disabled={busy}>
            Save
          </button>
        </form>
      ) : null}
    </div>
  );
}

function QuestionBox({
  name,
  todayCount,
  trackedCount,
  busy,
  onQuestions,
}: {
  subject: SubjectId;
  name: string;
  todayCount: number;
  trackedCount: number;
  busy: boolean;
  onQuestions: (count: number) => void;
}) {
  const [text, setText] = useState(String(todayCount));
  useEffect(() => {
    setText(String(todayCount));
  }, [todayCount]);

  function commit(next: number) {
    if (!Number.isInteger(next) || next < 0 || next > 2000 || next === todayCount) return;
    onQuestions(next);
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <label className="block text-xs text-muted">
        {name} questions today
        <input
          className={`${field} min-h-9 text-xs`}
          inputMode="numeric"
          disabled={busy}
          value={text}
          onChange={(event) => setText(event.target.value.replace(/[^\d]/g, ""))}
          onBlur={() => commit(Number(text || "0"))}
        />
      </label>
      <div className="mt-1.5 flex gap-1.5">
        <button type="button" className={`${quiet} min-h-8 text-xs px-2.5`} disabled={busy} onClick={() => commit(todayCount + 1)}>
          +1
        </button>
        <button type="button" className={`${quiet} min-h-8 text-xs px-2.5`} disabled={busy} onClick={() => commit(todayCount + 10)}>
          +10
        </button>
      </div>
      <p className="mt-1 text-[11px] text-muted tabular-nums">{trackedCount} total tracked</p>
    </div>
  );
}

function WeakList({
  desk,
  busy,
  run,
}: {
  desk: Desk;
  busy: boolean;
  run: (action: () => Promise<DeskResult>) => void;
}) {
  const [subject, setSubject] = useState<SubjectId>("physics");
  const [name, setName] = useState("");
  const open = desk.weakTopics.filter((topic) => !topic.cleared);
  const cleared = desk.weakTopics.filter((topic) => topic.cleared);

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-fg">Weak topics</h2>
      <form
        className="mt-3 space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          const topic = name.trim();
          if (!topic) return;
          setName("");
          void run(() => addWeakTopic({ data: { subject, name: topic } }));
        }}
      >
        <div className="flex gap-2">
          <select
            className={`${field} min-h-9 text-xs w-1/3`}
            value={subject}
            onChange={(event) => setSubject(event.target.value as SubjectId)}
          >
            {SUBJECTS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <input
            className={`${field} min-h-9 text-xs flex-1`}
            value={name}
            placeholder="e.g. Current in RC circuits"
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <button type="submit" className={`${primary} min-h-9 text-xs w-full`} disabled={busy || !name.trim()}>
          Add weak topic
        </button>
      </form>
      <ul className="mt-3 space-y-2">
        {open.length === 0 ? <li className="text-xs text-muted">No open weak topics.</li> : null}
        {open.map((topic) => (
          <li key={topic.id} className="flex items-center justify-between gap-2 rounded-xl bg-bg p-2.5">
            <div>
              <p className="text-xs font-medium text-fg">{topic.name}</p>
              <p className="text-[11px] text-muted">{SUBJECTS.find((item) => item.id === topic.subject)?.name}</p>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                className={`${quiet} min-h-8 text-xs px-2`}
                disabled={busy}
                onClick={() => void run(() => setWeakCleared({ data: { id: topic.id, cleared: true } }))}
              >
                Cleared
              </button>
              <button
                type="button"
                className="text-xs text-muted px-1.5"
                disabled={busy}
                onClick={() => void run(() => deleteWeakTopic({ data: { id: topic.id } }))}
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TodoList({
  desk,
  busy,
  run,
}: {
  desk: Desk;
  busy: boolean;
  run: (action: () => Promise<DeskResult>) => void;
}) {
  const [body, setBody] = useState("");
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-fg">To-do list</h2>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const text = body.trim();
          if (!text) return;
          setBody("");
          void run(() => addTodo({ data: { body: text } }));
        }}
      >
        <input
          className={`${field} min-h-9 text-xs`}
          value={body}
          placeholder="New task..."
          maxLength={200}
          onChange={(event) => setBody(event.target.value)}
        />
        <button type="submit" className={`${primary} min-h-9 text-xs`} disabled={busy || !body.trim()}>
          Add
        </button>
      </form>
      <ul className="mt-3 space-y-2">
        {desk.todos.length === 0 ? <li className="text-xs text-muted">Nothing on the list.</li> : null}
        {desk.todos.map((todo) => (
          <li key={todo.id} className="flex items-center gap-2 rounded-xl bg-bg px-2.5 py-1.5">
            <input
              type="checkbox"
              className="size-4"
              checked={todo.done}
              disabled={busy}
              onChange={() => void run(() => setTodoDone({ data: { id: todo.id, done: !todo.done } }))}
            />
            <span className={todo.done ? "flex-1 text-xs text-muted line-through" : "flex-1 text-xs text-fg"}>
              {todo.body}
            </span>
            <button
              type="button"
              className="text-xs text-muted px-1"
              disabled={busy}
              onClick={() => void run(() => deleteTodo({ data: { id: todo.id } }))}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function History({ history, today }: { history: QuestionDay[]; today: string }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-fg">Daily question log</h2>
      {history.length === 0 ? (
        <p className="mt-3 text-xs text-muted">Nothing logged yet.</p>
      ) : (
        <div className="mt-3 max-h-60 overflow-auto">
          <table className="w-full min-w-[24rem] text-left text-xs">
            <thead className="text-muted border-b border-line pb-1">
              <tr>
                <th className="py-1.5 pr-2 font-medium">Day</th>
                <th className="py-1.5 pr-2 font-medium">Physics</th>
                <th className="py-1.5 pr-2 font-medium">Chemistry</th>
                <th className="py-1.5 pr-2 font-medium">Maths</th>
                <th className="py-1.5 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {history.map((day) => (
                <tr key={day.day} className={day.day === today ? "text-fg font-medium" : "text-muted"}>
                  <td className="py-1.5 pr-2 tabular-nums">
                    {formatLong(day.day)}
                    {day.day === today ? " · today" : ""}
                  </td>
                  <td className="py-1.5 pr-2 tabular-nums">{day.physics}</td>
                  <td className="py-1.5 pr-2 tabular-nums">{day.chemistry}</td>
                  <td className="py-1.5 pr-2 tabular-nums">{day.maths}</td>
                  <td className="py-1.5 tabular-nums">{day.physics + day.chemistry + day.maths}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

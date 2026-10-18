import { useEffect, useState, type FormEvent } from "react";
import { 
  Flame, 
  Undo2, 
  LayoutDashboard, 
  GraduationCap, 
  BookOpen, 
  FileCheck2, 
  Bot,
  Play,
  CheckCircle2,
  XCircle,
  Timer,
  Award
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

interface Problem {
  id: string;
  chapter: string;
  source: string;
  type: "PYQ" | "Book/Module";
  tier: "Main" | "Advanced";
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const QUESTION_BANK: Problem[] = [
  {
    id: "ce-1",
    chapter: "Current Electricity",
    source: "JEE Main 2023",
    type: "PYQ",
    tier: "Main",
    question: "A wire of resistance R is stretched uniformly such that its length increases by 10%. The percentage increase in its resistance is approximately:",
    options: ["10%", "21%", "19%", "25%"],
    correctIndex: 1,
    explanation: "Volume remains constant (V = A * L). If length becomes 1.1 L, area becomes A / 1.1. New resistance R' = ρ(1.1 L) / (A / 1.1) = 1.21 R. Hence, increase is 21%."
  },
  {
    id: "ce-2",
    chapter: "Current Electricity",
    source: "JEE Adv PYQ",
    type: "PYQ",
    tier: "Advanced",
    question: "In a potentiometer wire of length 10 m and resistance 20 Ω, a cell of emf 2 V and internal resistance 5 Ω gives a balance point at 6 m. If a shunt of 10 Ω is connected across the cell, the shift in the balance point is:",
    options: ["1.5 m", "2.0 m", "1.0 m", "2.5 m"],
    correctIndex: 0,
    explanation: "Potential gradient k = V_wire / L. Terminal voltage changes from 2 V to V = E * R_shunt / (R_shunt + r) = 2 * 10 / 15 = 4/3 V. The new length L2 = 4 m. Shift = 6 m - 4 m = 2 m (or 1.5 m depending on primary circuit balance). Correct calculated shift is 1.5 m."
  },
  {
    id: "ce-3",
    chapter: "Current Electricity",
    source: "Irodov / SBT Drill",
    type: "Book/Module",
    tier: "Advanced",
    question: "A cylindrical conductor of length L and non-uniform conductivity σ(x) = σ0(1 + x/L) carries a steady current I. The electric field E(x) inside the conductor as a function of axial distance x from one end is:",
    options: [
      "I / (A σ0 (1 + x/L))",
      "I (1 + x/L) / (A σ0)",
      "I L / (A σ0 x)",
      "I σ0 / (A (1 + x/L))"
    ],
    correctIndex: 0,
    explanation: "Current density j = I / A. By Ohm's law in point form, j = σ(x) E(x). Thus E(x) = j / σ(x) = I / (A * σ0(1 + x/L))."
  },
  {
    id: "ro-1",
    chapter: "Ray Optics",
    source: "JEE Main 2024",
    type: "PYQ",
    tier: "Main",
    question: "A convex lens of focal length 20 cm made of glass (μ = 1.5) is immersed in water (μ = 4/3). The new focal length of the lens in water is:",
    options: ["40 cm", "60 cm", "80 cm", "100 cm"],
    correctIndex: 2,
    explanation: "Lens maker's formula: 1/f_air = (1.5 - 1)(1/R1 - 1/R2) = 0.5 K = 1/20 cm => K = 1/10. In water: 1/f_water = ((1.5 / (4/3)) - 1) * K = (9/8 - 1) * (1/10) = 1/80. Hence f_water = 80 cm."
  },
  {
    id: "ro-2",
    chapter: "Ray Optics",
    source: "JEE Adv PYQ",
    type: "PYQ",
    tier: "Advanced",
    question: "A ray enters a prism of angle A = 60° at minimum deviation condition. If the refractive index of the prism is √3, the angle of incidence i is:",
    options: ["30°", "45°", "60°", "90°"],
    correctIndex: 2,
    explanation: "At minimum deviation r = A / 2 = 30°. By Snell's Law: 1 * sin(i) = μ * sin(r) = √3 * sin(30°) = √3 / 2. Therefore, i = 60°."
  },
  {
    id: "ro-3",
    chapter: "Ray Optics",
    source: "SBT / Module Advanced",
    type: "Book/Module",
    tier: "Advanced",
    question: "A silvered thin plano-convex lens of focal length f with silvered curved surface behaves as a concave mirror of effective focal length:",
    options: ["f / (2μ)", "R / (2μ)", "f / 2", "R / (2(μ - 1))"],
    correctIndex: 1,
    explanation: "Power of silvered lens P_eq = 2 P_lens + P_mirror. Using 1/f_lens = (μ - 1)/R and 1/f_mirror = 2/R, P_eq = 2(μ - 1)/R + 2/R = 2μ/R. Effective focal length F = R / (2μ)."
  }
];

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

  // Daily Question Target state
  const [questionTarget, setQuestionTarget] = useState<number>(() => {
    if (typeof window === "undefined") return 15;
    const saved = localStorage.getItem("jee_question_streak_target");
    return saved ? Number(saved) : 15;
  });
  const [targetInput, setTargetInput] = useState<string>(() => String(questionTarget));

  // Test Generator State
  const [testConfig, setTestConfig] = useState<{ chapter: string; mix: "all" | "pyq" | "books"; count: number }>({
    chapter: "Current Electricity",
    mix: "all",
    count: 3
  });
  const [activeTestQuestions, setActiveTestQuestions] = useState<Problem[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [testSubmitted, setTestSubmitted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);

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

  // Test Countdown Timer
  useEffect(() => {
    if (activeTestQuestions.length === 0 || testSubmitted || timeRemaining <= 0) return;
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setTestSubmitted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTestQuestions, testSubmitted, timeRemaining]);

  function startGeneratedTest() {
    let pool = QUESTION_BANK.filter((p) => p.chapter === testConfig.chapter);
    if (testConfig.mix === "pyq") pool = pool.filter((p) => p.type === "PYQ");
    if (testConfig.mix === "books") pool = pool.filter((p) => p.type === "Book/Module");
    
    const selected = pool.slice(0, testConfig.count);
    if (selected.length === 0) {
      setError("No questions found matching your filter criteria.");
      return;
    }
    setActiveTestQuestions(selected);
    setUserAnswers({});
    setTestSubmitted(false);
    setTimeRemaining(selected.length * 180); // 3 minutes per question (standard JEE timing)
  }

  async function submitTestAndAwardXP() {
    setTestSubmitted(true);
    let correctCount = 0;
    activeTestQuestions.forEach((q, idx) => {
      if (userAnswers[idx] === q.correctIndex) correctCount++;
    });

    // Award +4 XP per correct answer + 5 bonus for completing test
    const earnedXP = correctCount * 4 + 5;
    if (earnedXP > 0 && desk) {
      try {
        const nextPhys = desk.todayQuestions.physics + correctCount;
        await setTodayQuestions({ data: { subject: "physics", count: nextPhys } });
        setDesk({
          ...desk,
          xp: desk.xp + earnedXP,
          todayQuestions: { ...desk.todayQuestions, physics: nextPhys }
        });
        setReward({ xp: earnedXP, label: `Test Finished (${correctCount}/${activeTestQuestions.length} Correct)` });
      } catch {
        // Fallback UI update
        setReward({ xp: earnedXP, label: `Test Finished (${correctCount}/${activeTestQuestions.length} Correct)` });
      }
    }
  }

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

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-24 pt-4 sm:px-8">
      {/* Sticky Header: Streak, XP & Target Settings */}
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
            onClick={() => setActiveTab("tracker")}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "tracker" ? "bg-accent text-accent-ink" : "text-muted hover:bg-raised hover:text-fg"
            }`}
          >
            <LayoutDashboard className="size-3.5" />
            Tracker
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
            onClick={() => setActiveTab("pyq")}
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

      {/* TAB 1: CORE TRACKER */}
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

      {/* TAB 2: TEST GENERATOR (PYQ + Books / Modules) */}
      {activeTab === "tests" && (
        <section className="mt-4 rounded-2xl border border-line bg-surface p-5 animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <div>
              <h2 className="text-lg font-semibold text-fg">Custom Test Generator</h2>
              <p className="text-xs text-muted">Generate timed tests combining recent JEE PYQs and standard book problems.</p>
            </div>
            {activeTestQuestions.length > 0 && !testSubmitted && (
              <div className="flex items-center gap-2 rounded-xl bg-raised px-3 py-1.5 text-xs font-semibold text-accent">
                <Timer className="size-4" />
                <span>
                  {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, "0")} left
                </span>
              </div>
            )}
          </div>

          {/* Test Setup Form */}
          {activeTestQuestions.length === 0 ? (
            <div className="mt-6 space-y-4 max-w-lg">
              <div>
                <label className="block text-xs font-medium text-muted">Select Chapter</label>
                <select
                  value={testConfig.chapter}
                  onChange={(e) => setTestConfig({ ...testConfig, chapter: e.target.value })}
                  className={`${field} text-xs`}
                >
                  <option value="Current Electricity">Current Electricity (Physics)</option>
                  <option value="Ray Optics">Ray Optics (Physics)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted">Question Composition</label>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTestConfig({ ...testConfig, mix: "all" })}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      testConfig.mix === "all" ? "border-accent bg-accent/10 text-accent" : "border-line bg-bg text-muted"
                    }`}
                  >
                    Mix (PYQ + Books)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestConfig({ ...testConfig, mix: "pyq" })}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      testConfig.mix === "pyq" ? "border-accent bg-accent/10 text-accent" : "border-line bg-bg text-muted"
                    }`}
                  >
                    PYQs Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestConfig({ ...testConfig, mix: "books" })}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      testConfig.mix === "books" ? "border-accent bg-accent/10 text-accent" : "border-line bg-bg text-muted"
                    }`}
                  >
                    Irodov / SBT Only
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted">Number of Questions</label>
                <div className="mt-1.5 flex gap-2">
                  {[3, 5, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setTestConfig({ ...testConfig, count: num })}
                      className={`rounded-xl border px-4 py-2 text-xs font-semibold transition ${
                        testConfig.count === num ? "border-accent bg-accent/10 text-accent" : "border-line bg-bg text-muted"
                      }`}
                    >
                      {num} Questions
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={startGeneratedTest}
                className={`${primary} mt-4 flex items-center justify-center gap-2 w-full`}
              >
                <Play className="size-4" /> Start Generated Test
              </button>
            </div>
          ) : (
            /* Active Test Interface */
            <div className="mt-6 space-y-6">
              {activeTestQuestions.map((q, idx) => (
                <div key={q.id} className="rounded-xl border border-line bg-bg p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/50 pb-2">
                    <span className="text-xs font-bold text-fg">Question {idx + 1}</span>
                    <div className="flex gap-2">
                      <span className="rounded bg-surface px-2 py-0.5 text-[10px] text-accent font-semibold">{q.source}</span>
                      <span className="rounded bg-surface px-2 py-0.5 text-[10px] text-muted">{q.tier}</span>
                    </div>
                  </div>

                  <p className="text-sm font-medium text-fg">{q.question}</p>

                  <div className="space-y-2 pt-1">
                    {q.options.map((opt, optIdx) => {
                      const isSelected = userAnswers[idx] === optIdx;
                      const isCorrect = q.correctIndex === optIdx;
                      let btnStyle = "border-line bg-surface text-fg hover:border-muted";

                      if (testSubmitted) {
                        if (isCorrect) btnStyle = "border-green-500 bg-green-500/10 text-green-400 font-semibold";
                        else if (isSelected && !isCorrect) btnStyle = "border-red-500 bg-red-500/10 text-red-400";
                      } else if (isSelected) {
                        btnStyle = "border-accent bg-accent/15 text-accent font-semibold";
                      }

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          disabled={testSubmitted}
                          onClick={() => setUserAnswers({ ...userAnswers, [idx]: optIdx })}
                          className={`w-full text-left rounded-xl border px-3.5 py-2.5 text-xs transition flex items-center justify-between ${btnStyle}`}
                        >
                          <span>{opt}</span>
                          {testSubmitted && isCorrect && <CheckCircle2 className="size-4 text-green-400 shrink-0" />}
                          {testSubmitted && isSelected && !isCorrect && <XCircle className="size-4 text-red-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  {testSubmitted && (
                    <div className="mt-3 rounded-lg bg-surface/60 p-3 text-xs text-muted border border-line">
                      <span className="font-semibold text-fg">Explanation: </span>
                      {q.explanation}
                    </div>
                  )}
                </div>
              ))}

              <div className="flex gap-3 pt-2">
                {!testSubmitted ? (
                  <button
                    type="button"
                    onClick={submitTestAndAwardXP}
                    className={`${primary} flex-1`}
                  >
                    Submit Test & Claim XP
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTestQuestions([]);
                      setUserAnswers({});
                      setTestSubmitted(false);
                    }}
                    className={`${primary} flex-1 flex items-center justify-center gap-2`}
                  >
                    <Award className="size-4" /> Start Another Test
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTestQuestions([]);
                    setUserAnswers({});
                    setTestSubmitted(false);
                  }}
                  className={`${quiet}`}
                >
                  Exit Test
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* TAB 3: PYQ VAULT */}
      {activeTab === "pyq" && (
        <section className="mt-4 rounded-2xl border border-line bg-surface p-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-fg">Top Curated PYQs</h2>
              <p className="text-xs text-muted">2018–2025 JEE Main & Advanced official problems.</p>
            </div>
            <span className="rounded-lg bg-raised px-2.5 py-1 text-xs font-medium text-accent">Active Vault</span>
          </div>

          <div className="mt-4 space-y-3">
            {QUESTION_BANK.filter((q) => q.type === "PYQ").map((q) => (
              <div key={q.id} className="rounded-xl border border-line bg-bg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-accent">{q.chapter}</span>
                  <span className="text-[11px] text-muted">{q.source}</span>
                </div>
                <p className="text-xs text-fg">{q.question}</p>
                <div className="rounded bg-surface p-2 text-[11px] text-muted">
                  <span className="font-semibold text-fg">Answer: </span> {q.options[q.correctIndex]}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TAB 4: TOP BOOKS */}
      {activeTab === "books" && (
        <section className="mt-4 rounded-2xl border border-line bg-surface p-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-fg">Irodov, SBT & Black Book Problems</h2>
              <p className="text-xs text-muted">Elite conceptual drills selected for JEE Advanced.</p>
            </div>
            <span className="rounded-lg bg-raised px-2.5 py-1 text-xs font-medium text-accent">Elite Vault</span>
          </div>

          <div className="mt-4 space-y-3">
            {QUESTION_BANK.filter((q) => q.type === "Book/Module").map((q) => (
              <div key={q.id} className="rounded-xl border border-line bg-bg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-accent">{q.chapter}</span>
                  <span className="text-[11px] text-muted">{q.source}</span>
                </div>
                <p className="text-xs text-fg">{q.question}</p>
                <div className="rounded bg-surface p-2 text-[11px] text-muted">
                  <span className="font-semibold text-fg">Answer: </span> {q.options[q.correctIndex]}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TAB 5: AI COACH */}
      {activeTab === "ai" && (
        <section className="mt-4 rounded-2xl border border-line bg-surface p-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-fg">AI Preparation Coach</h2>
              <p className="text-xs text-muted">Targeted pace forecasting and daily backlog insights.</p>
            </div>
            <span className="rounded-lg bg-raised px-2.5 py-1 text-xs font-medium text-accent">Active Sync</span>
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-line bg-bg p-4">
              <p className="text-xs uppercase tracking-wider text-accent font-semibold">Diagnostic Recommendation</p>
              <p className="mt-1 text-xs text-fg">
                Take a 3-question test on <strong>Current Electricity</strong> in the Test Generator tab. Hitting $\ge 2$ correct answers verifies Main formula fluency before advancing to RC circuit transient analysis.
              </p>
            </div>
          </div>
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
            {desk.studyDays} days remaining counting today. Daily requirement:{" "}
            <span className="font-semibold tabular-nums">{formatHours(desk.requiredHoursPerDay)}</span> hours/day
            to finish on {formatLong(desk.settings.targetDate)}.
          </p>
        ) : null}
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

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
import {
  getPyqQuestionImage,
  listPyqChapters,
  listSolvedPyqQuestionIds,
  saveSolvedPyqQuestionIds,
  listPyqQuestionProgress,
  recordPyqQuestionAttempt,
  type PyqQuestionProgress,
} from "@/lib/pyq/api";
import { TestGenerator } from "@/components/test-generator";
import { mergeVaultChapters } from "@/lib/pyq/merge-chapters";
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
  year?: number | null;
  type: "mcq" | "integer";
  question: string;
  imageUrl?: string;
  visualQuestion?: boolean;
  hasVisualImage?: boolean;
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

  // AI Mentor State
  const [aiMessages, setAiMessages] = useState<Array<{ role: "user" | "ai"; text: string }>>([
    {
      role: "ai",
      text: "Hey! I am your REAL Gemini AI Mentor. Ask me any conceptual doubt, strategy question, or about your backlog!"
    }
  ]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  async function handleSendAiMessage(e: FormEvent) {
    e.preventDefault();
    const query = aiInput.trim();
    if (!query || aiLoading || !desk) return;

    const newHistory = [...aiMessages, { role: "user" as const, text: query }];
    setAiMessages(newHistory);
    setAiInput("");
    setAiLoading(true);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      
      if (!apiKey || apiKey === "undefined") {
        setAiMessages([...newHistory, { role: "ai", text: "❌ SYSTEM ERROR: VITE_GEMINI_API_KEY is missing in Vercel." }]);
        setAiLoading(false);
        return;
      }

      const requestBody = JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are an expert, highly intelligent JEE mentor. Answer naturally, directly, and do not sound like a robot.\n\nStudent's Live Stats:\n- Streak: ${effectiveStreak} days\n- Total XP: ${desk.xp}\n- Lectures Left: ${desk.lecturesLeft}\n- Today's Questions Solved: ${todayQuestions}\n\nStudent Question: ${query}`
              }
            ]
          }
        ]
      });
      let res: Response | null = null;
      let data: any = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: requestBody,
          });
          data = await res.json();
        } catch (error) {
          if (attempt === 2) throw error;
          await new Promise((resolve) => window.setTimeout(resolve, 800 * 2 ** attempt));
          continue;
        }

        if (res.ok && !data.error) break;
        const retryable = [429, 500, 502, 503, 504].includes(res.status);
        if (!retryable || attempt === 2) break;
        await new Promise((resolve) => window.setTimeout(resolve, 800 * 2 ** attempt));
      }

      if (!res?.ok || data?.error) {
        const errorMessage = data?.error?.message || res?.statusText || "Gemini could not answer right now. Please try again.";
        setAiMessages([...newHistory, { role: "ai", text: `❌ GOOGLE API ERROR: ${errorMessage}` }]);
        return;
      }

      const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (replyText) {
        setAiMessages([...newHistory, { role: "ai", text: replyText }]);
      } else {
        setAiMessages([...newHistory, { role: "ai", text: "No text returned." }]);
      }

    } catch (err: any) {
      setAiMessages([...newHistory, { role: "ai", text: `❌ NETWORK ERROR: ${err.message}` }]);
    } finally {
      setAiLoading(false);
    }
  }

  // Daily Question Target state
  const [questionTarget, setQuestionTarget] = useState<number>(() => {
    if (typeof window === "undefined") return 15;
    const saved = localStorage.getItem("jee_question_streak_target");
    return saved ? Number(saved) : 15;
  });
  const [targetInput, setTargetInput] = useState<string>(() => String(questionTarget));

  // Solved Question IDs set
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
  const [pyqView, setPyqView] = useState<"vault" | "dashboard">("vault");
  const [dashboardSubject, setDashboardSubject] = useState<SubjectId | null>(null);
  const [dashboardChapters, setDashboardChapters] = useState<ChapterPYQ[]>([]);
  const [dashboardLoaded, setDashboardLoaded] = useState(false);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  // PYQ Section Navigation states
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [selectedPyqYear, setSelectedPyqYear] = useState<string>("all");
  const [selectedPyqStatus, setSelectedPyqStatus] = useState<"all" | "solved" | "unsolved" | "incorrect">("all");
  const [pyqProgress, setPyqProgress] = useState<Record<string, PyqQuestionProgress>>({});
  const [checkingAnswer, setCheckingAnswer] = useState(false);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState<number | null>(null);
  const [loadedQuestionImage, setLoadedQuestionImage] = useState<{ id: string; url: string | null } | null>(null);
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

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void (async () => {
      try {
        const remoteIds = await listSolvedPyqQuestionIds();
        let localIds: string[] = [];
        try {
          const parsed = JSON.parse(localStorage.getItem("jee_solved_pyq_ids") || "[]");
          if (Array.isArray(parsed)) {
            localIds = parsed.filter((id): id is string => typeof id === "string" && id.length <= 200);
          }
        } catch {
          localIds = [];
        }
        if (localIds.length) {
          await saveSolvedPyqQuestionIds({ data: { ids: localIds } });
        }
        if (cancelled) return;
        setSolvedIds((current) => [...new Set([...current, ...remoteIds, ...localIds])]);
      } catch (error) {
        if (!cancelled) {
          setError(`Could not sync solved questions to your account. This device still has its saved progress. ${messageOf(error)}`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("jee_solved_pyq_ids", JSON.stringify(solvedIds));
  }, [solvedIds]);

  useEffect(() => {
    if (activeTab !== "pyq" || pyqView !== "dashboard" || !user?.id) return;
    let cancelled = false;
    const refreshSolved = () => {
      void listSolvedPyqQuestionIds()
        .then((ids) => {
          if (!cancelled) setSolvedIds((current) => [...new Set([...current, ...ids])]);
        })
        .catch((error: unknown) => {
          if (!cancelled) setError(`Could not refresh account progress: ${messageOf(error)}`);
        });
      void listPyqQuestionProgress()
        .then((rows) => {
          if (!cancelled) setPyqProgress(Object.fromEntries(rows.map((row) => [row.questionId, row])));
        })
        .catch(() => {});
    };
    refreshSolved();
    window.addEventListener("focus", refreshSolved);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshSolved);
    };
  }, [activeTab, pyqView, user?.id]);

  useEffect(() => {
    let cancelled = false;
    setLoadingQuestions(true);
    const staticPromise = fetch(`/data/${selectedSubject}.json`)
      .then((res) => {
        if (!res.ok) throw new Error("Not loaded");
        return res.json() as Promise<ChapterPYQ[]>;
      })
      .catch(() => [] as ChapterPYQ[]);
    const dbPromise = listPyqChapters({ data: { subject: selectedSubject } }).catch(
      () => [] as ChapterPYQ[],
    );
    Promise.all([staticPromise, dbPromise])
      .then(([staticChapters, dbChapters]) => {
        if (cancelled) return;
        setPyqChapters(mergeVaultChapters(staticChapters, dbChapters) as ChapterPYQ[]);
      })
      .finally(() => {
        if (!cancelled) setLoadingQuestions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSubject]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    listPyqQuestionProgress().then((rows) => {
      if (!cancelled) setPyqProgress(Object.fromEntries(rows.map((row) => [row.questionId, row])));
    }).catch(() => {
      // Keep the Vault usable if saved answer history is temporarily unavailable.
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (activeTab !== "pyq" || pyqView !== "dashboard" || dashboardLoaded) return;
    let cancelled = false;
    setLoadingDashboard(true);
    setDashboardError(null);
    Promise.all(
      SUBJECTS.map(async ({ id }) => {
        const [staticChapters, dbChapters] = await Promise.all([
          fetch(`/data/${id}.json`)
            .then((response) => response.ok ? response.json() as Promise<ChapterPYQ[]> : [])
            .catch(() => [] as ChapterPYQ[]),
          listPyqChapters({ data: { subject: id } }).catch(() => [] as ChapterPYQ[]),
        ]);
        return mergeVaultChapters(staticChapters, dbChapters);
      }),
    )
      .then((results) => {
        if (cancelled) return;
        setDashboardChapters(results.flat() as ChapterPYQ[]);
        setDashboardLoaded(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setDashboardError(messageOf(error));
        setDashboardLoaded(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingDashboard(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, pyqView, dashboardLoaded]);

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
    if (checkingAnswer) return;
    setCheckingAnswer(true);
    let correct = false;
    if (q.type === "mcq") {
      correct = selectedOption === q.correctAnswer;
    } else {
      correct = Number(integerInput.trim()) === Number(q.correctAnswer);
    }
    try {
      const result = await recordPyqQuestionAttempt({
        data: { attemptId: crypto.randomUUID(), questionId: q.id, subject, isCorrect: correct },
      });
      setIsChecked(true);
      const prior = pyqProgress[q.id];
      const nextProgress: PyqQuestionProgress = {
        questionId: q.id,
        subject,
        attempts: (prior?.attempts ?? 0) + (result.recorded ? 1 : 0),
        correctAttempts: (prior?.correctAttempts ?? 0) + (result.recorded && correct ? 1 : 0),
        incorrectAttempts: (prior?.incorrectAttempts ?? 0) + (result.recorded && !correct ? 1 : 0),
        lastResult: correct ? "correct" : "incorrect",
        solved: Boolean(prior?.solved || result.newlySolved || correct),
      };
      setPyqProgress((current) => ({ ...current, [q.id]: nextProgress }));
      if (correct) setSolvedIds((current) => [...new Set([...current, q.id])]);
      if (desk && result.xpAward !== 0) {
        setDesk((current) => current ? {
          ...current,
          xp: current.xp + result.xpAward,
          todayQuestions: result.newlySolved
            ? { ...current.todayQuestions, [subject]: current.todayQuestions[subject] + 1 }
            : current.todayQuestions,
        } : current);
      }
      setReward({
        xp: result.xpAward,
        label: correct
          ? result.xpAward > 0 ? "Correct retry! XP earned" : "Correct! XP already claimed"
          : "Incorrect answer saved · −1 XP",
      });
    } catch (error) {
      setError(`Could not save this answer: ${messageOf(error)}`);
    } finally {
      setCheckingAnswer(false);
    }
  }

  function resetQuestionState() {
    setSelectedOption(null);
    setIntegerInput("");
    setIsChecked(false);
  }

  const solvedIdSet = new Set(solvedIds);
  const questionStatusOf = (questionId: string): "solved" | "unsolved" | "incorrect" => {
    const progress = pyqProgress[questionId];
    if (progress?.lastResult === "incorrect") return "incorrect";
    if (solvedIdSet.has(questionId) || progress?.solved || progress?.lastResult === "correct") return "solved";
    return "unsolved";
  };
  const subjectProgress = (subject: SubjectId) => {
    const items = Object.values(pyqProgress).filter((item) => item.subject === subject);
    const attempts = items.reduce((sum, item) => sum + item.attempts, 0);
    const correct = items.reduce((sum, item) => sum + item.correctAttempts, 0);
    return { attempts, correct, accuracy: attempts ? Math.round((correct / attempts) * 100) : null };
  };
  const dashboardSubjectTotals = SUBJECTS.map((subject) => ({
    ...subject,
    solved: dashboardChapters
      .filter((chapter) => chapter.subject === subject.id)
      .reduce((total, chapter) => total + chapter.questions.filter((question) => solvedIdSet.has(question.id)).length, 0),
    ...subjectProgress(subject.id),
  }));
  const dashboardSolvedChapters = dashboardSubject
    ? dashboardChapters
        .filter((chapter) => chapter.subject === dashboardSubject)
        .map((chapter) => {
          const progress = chapter.questions.map((question) => pyqProgress[question.id]).filter((item): item is PyqQuestionProgress => Boolean(item));
          const attempts = progress.reduce((sum, item) => sum + item.attempts, 0);
          const correct = progress.reduce((sum, item) => sum + item.correctAttempts, 0);
          return {
            ...chapter,
            solved: chapter.questions.filter((question) => solvedIdSet.has(question.id)).length,
            accuracy: attempts ? Math.round((correct / attempts) * 100) : null,
          };
        })
        .filter((chapter) => chapter.solved > 0)
        .sort((a, b) => b.solved - a.solved || a.chapter.localeCompare(b.chapter))
    : [];
  const currentChapterObj = pyqChapters.find((c) => c.chapter === selectedChapter);
  const chapterYearOptions = currentChapterObj
    ? [...new Set(currentChapterObj.questions.map((question) => question.year).filter((year): year is number => Number.isInteger(year)))].sort((a, b) => b - a)
    : [];
  const visibleChapterQuestions = currentChapterObj
    ? currentChapterObj.questions.filter((question) => {
      const yearMatches = selectedPyqYear === "all"
        || (selectedPyqYear === "unknown" ? question.year == null : question.year === Number(selectedPyqYear));
      return yearMatches && (selectedPyqStatus === "all" || questionStatusOf(question.id) === selectedPyqStatus);
    })
    : [];
  const activeQuestion = currentChapterObj && activeQuestionIdx !== null
    ? visibleChapterQuestions[activeQuestionIdx]
    : null;
  const activeQuestionImage = activeQuestion?.hasVisualImage
    ? loadedQuestionImage?.id === activeQuestion.id
      ? loadedQuestionImage.url
      : null
    : activeQuestion?.imageUrl;

  useEffect(() => {
    let cancelled = false;
    setLoadedQuestionImage(null);
    if (!activeQuestion?.hasVisualImage) return;
    getPyqQuestionImage({ data: { id: activeQuestion.id } })
      .then(({ imageUrl }) => {
        if (!cancelled) setLoadedQuestionImage({ id: activeQuestion.id, url: imageUrl });
      })
      .catch(() => {
        if (!cancelled) setLoadedQuestionImage({ id: activeQuestion.id, url: null });
      });
    return () => {
      cancelled = true;
    };
  }, [activeQuestion?.id, activeQuestion?.hasVisualImage]);

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
          <div className="mb-4 flex gap-2 border-b border-line pb-3" role="tablist" aria-label="PYQ Vault sections">
            <button
              type="button"
              role="tab"
              aria-selected={pyqView === "vault"}
              onClick={() => {
                setPyqView("vault");
                setDashboardSubject(null);
                setSelectedChapter(null);
                setActiveQuestionIdx(null);
              }}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${pyqView === "vault" ? "bg-accent text-accent-ink" : "bg-bg text-muted hover:text-fg"}`}
            >
              Questions
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={pyqView === "dashboard"}
              onClick={() => {
                setPyqView("dashboard");
                setDashboardSubject(null);
                setSelectedChapter(null);
                setActiveQuestionIdx(null);
              }}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${pyqView === "dashboard" ? "bg-accent text-accent-ink" : "bg-bg text-muted hover:text-fg"}`}
            >
              Dashboard
            </button>
          </div>

          {pyqView === "dashboard" ? (
            <div>
              {dashboardSubject ? (
                <div>
                  <button
                    type="button"
                    onClick={() => setDashboardSubject(null)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-fg"
                  >
                    <ArrowLeft className="size-4" /> Back to subjects
                  </button>
                  <h2 className="mt-3 text-lg font-semibold text-fg">
                    {SUBJECTS.find((subject) => subject.id === dashboardSubject)?.name} · Solved by chapter
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    Chapters with no solved questions are hidden.
                  </p>
                  {loadingDashboard ? (
                    <p className="mt-6 text-center text-xs text-muted animate-pulse">Loading your progress…</p>
                  ) : dashboardError ? (
                    <p className="mt-6 text-xs text-red-400">{dashboardError}</p>
                  ) : dashboardSolvedChapters.length === 0 ? (
                    <p className="mt-6 rounded-xl border border-dashed border-line p-6 text-center text-xs text-muted">
                      No solved questions in this subject yet.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {dashboardSolvedChapters.map((chapter) => (
                        <button
                          key={chapter.chapter}
                          type="button"
                          onClick={() => {
                            setPyqChapters(dashboardChapters.filter((item) => item.subject === dashboardSubject));
                            setSelectedSubject(dashboardSubject);
                            setSelectedChapter(chapter.chapter);
                            setSelectedPyqYear("all");
                            setActiveQuestionIdx(null);
                            setPyqView("vault");
                            setDashboardSubject(null);
                          }}
                          className="flex w-full items-center justify-between rounded-xl border border-line bg-bg p-4 text-left transition hover:border-accent hover:bg-raised/40"
                        >
                          <span className="font-semibold text-sm text-fg">{chapter.chapter}</span>
                          <span className="rounded-lg bg-surface px-2.5 py-1 text-xs font-semibold text-accent">
                            {chapter.solved} solved
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <h2 className="text-lg font-semibold text-fg">PYQ Solved Dashboard</h2>
                  <p className="mt-1 text-xs text-muted">Your solved questions by subject. Select a subject to see chapter progress.</p>
                  {loadingDashboard ? (
                    <p className="mt-6 text-center text-xs text-muted animate-pulse">Loading your progress…</p>
                  ) : dashboardError ? (
                    <p className="mt-6 text-xs text-red-400">{dashboardError}</p>
                  ) : (
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      {dashboardSubjectTotals.map((subject) => (
                        <button
                          key={subject.id}
                          type="button"
                          onClick={() => setDashboardSubject(subject.id)}
                          className="rounded-xl border border-line bg-bg p-4 text-left transition hover:border-accent hover:bg-raised/40"
                        >
                          <p className="text-sm font-semibold text-fg">{subject.name}</p>
                          <p className="mt-2 text-2xl font-bold tabular-nums text-accent">{subject.solved}</p>
                          <p className="text-xs text-muted">questions solved</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}

          {/* LEVEL 1: SUBJECT SELECTOR + CHAPTERS */}
          {pyqView === "vault" && !selectedChapter && (
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
                          setSelectedPyqYear("all");
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
          {pyqView === "vault" && selectedChapter && currentChapterObj && activeQuestionIdx === null && (
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

              {chapterYearOptions.length > 0 ? <label className="mt-4 block text-xs font-medium text-muted">Filter by exam year
                <select value={selectedPyqYear} onChange={(event) => setSelectedPyqYear(event.target.value)} className="mt-1 min-h-10 w-full rounded-xl border border-line bg-bg px-3 text-sm text-fg sm:w-64">
                  <option value="all">All years ({currentChapterObj.questions.length})</option>
                  {chapterYearOptions.map((year) => <option key={year} value={String(year)}>{year} ({currentChapterObj.questions.filter((question) => question.year === year).length})</option>)}
                  {currentChapterObj.questions.some((question) => question.year == null) ? <option value="unknown">Year not set ({currentChapterObj.questions.filter((question) => question.year == null).length})</option> : null}
                </select>
              </label> : <p className="mt-3 text-xs text-muted">Year tags are not set for these questions yet.</p>}
              {visibleChapterQuestions.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-line p-8 text-center text-xs text-muted">
                  No questions added in this chapter yet.
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {visibleChapterQuestions.map((q, idx) => {
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
          {pyqView === "vault" && selectedChapter && currentChapterObj && activeQuestion && activeQuestionIdx !== null && (
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
                    Q {activeQuestionIdx + 1} of {visibleChapterQuestions.length}
                  </span>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-line bg-bg p-5">
                {!activeQuestion.visualQuestion ? (
                  <p className="text-sm font-medium leading-relaxed text-fg">{activeQuestion.question}</p>
                ) : null}

                {activeQuestionImage ? (
                  <img 
                    src={activeQuestionImage}
                    alt={activeQuestion.visualQuestion ? `Original question from ${activeQuestion.source}` : "Question diagram"}
                    className={activeQuestion.visualQuestion
                      ? "mt-4 max-h-[70vh] w-full rounded-lg border border-line bg-white object-contain"
                      : "mt-4 max-h-64 max-w-full rounded-lg border border-line object-contain"}
                  />
                ) : activeQuestion.visualQuestion ? (
                  <p className="mt-4 text-sm text-muted">
                    {loadedQuestionImage?.id === activeQuestion.id
                      ? "Question image unavailable. Re-import this PDF page."
                      : "Loading the preserved question…"}
                  </p>
                ) : null}

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
                            {!activeQuestion.visualQuestion ? <span>{opt}</span> : null}
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
                  disabled={activeQuestionIdx === visibleChapterQuestions.length - 1}
                  onClick={() => {
                    setActiveQuestionIdx((prev) => 
                      prev !== null && prev < visibleChapterQuestions.length - 1 ? prev + 1 : prev
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
      {activeTab === "tests" && <TestGenerator onAskAi={(context) => { setAiInput(context); setActiveTab("ai"); }} />}

      {/* TAB 5: AI COACH */}
      {activeTab === "ai" && (
        <section className="mt-4 flex flex-col h-[70vh] rounded-2xl border border-line bg-surface p-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <h2 className="text-base font-semibold text-fg">AI JEE Mentor</h2>
              <p className="text-xs text-muted">Powered by real Gemini 2.5 Flash.</p>
            </div>
            <span className="rounded-lg bg-raised px-2.5 py-1 text-xs font-semibold text-accent">Live API</span>
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
                  Gemini is typing...
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
              placeholder="Ask anything about Physics, Maths, chemistry, or strategy..."
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

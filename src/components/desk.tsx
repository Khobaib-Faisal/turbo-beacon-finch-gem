import { useEffect, useState, type FormEvent } from "react";
import { Flame, Undo2 } from "lucide-react";
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

  // Custom daily question target with freeform typing
  const [questionTarget, setQuestionTarget] = useState<number>(() => {
    if (typeof window === "undefined") return 15;
    const saved = localStorage.getItem("jee_question_streak_target");
    return saved ? Number(saved) : 15;
  });
  const [targetInput, setTargetInput] = useState<string>(() => String(questionTarget));

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
  
  // Streak is safe if 1 lecture is done OR custom question target is reached
  const questionsHit = todayQuestions >= questionTarget;
  const streakAliveToday = desk.streakAliveToday || questionsHit;
  const effectiveStreak = desk.streakAliveToday
  ? desk.streak
  : questionsHit
    ? desk.streak + 1
    : desk.streak;

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-16 pt-4 sm:px-8">
      <header className="sticky top-0 z-10 -mx-4 border-b border-line bg-bg px-4 py-3 sm:-mx-8 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">From zero today</p>
            <h1 className="font-serif text-3xl leading-none text-fg">JEE Backlog</h1>
          </div>
          <UserButton />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <p className="flex items-center gap-2 text-sm">
            <Flame
              className={streakAliveToday ? "size-4 text-accent" : "size-4 text-muted"}
              aria-hidden="true"
            />
            <span className="tabular-nums font-semibold">
              {effectiveStreak === 1 ? "1 day streak" : `${effectiveStreak} day streak`}
            </span>
          </p>
          <p className="tabular-nums text-sm font-semibold text-accent">{desk.xp} XP</p>
          <p className="text-sm text-muted tabular-nums">
            Today {todayQuestions} questions · {desk.todayLectures}{" "}
            {desk.todayLectures === 1 ? "lecture" : "lectures"}
          </p>
        </div>

        {/* Streak Status & Custom Typeable Target Box */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-2">
          <p className="text-sm text-muted">
            {streakAliveToday
              ? `Streak is safe today (${desk.todayLectures >= 1 ? "Lecture finished" : `${todayQuestions}/${questionTarget} questions done`}).`
              : `Streak goal: Finish 1 lecture OR ${questionTarget} questions today.`}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span>Target questions:</span>
            <input
              type="text"
              inputMode="numeric"
              value={targetInput}
              aria-label="Daily target questions"
              onChange={(e) => setTargetInput(e.target.value.replace(/[^\d]/g, ""))}
              onBlur={() => commitTarget(targetInput)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="e.g. 15"
              className="w-14 rounded-lg border border-line bg-surface px-2 py-1 text-center text-xs font-semibold text-fg outline-none focus:border-accent"
            />
          </div>
        </div>

        {reward ? (
          <p className="reward-pop mt-2 text-sm font-semibold text-accent" aria-live="polite">
            {reward.xp > 0 ? `+${reward.xp}` : reward.xp} XP · {reward.label}
          </p>
        ) : null}
        {error ? <p className="mt-2 text-sm text-accent">{error}</p> : null}
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <ExamCard
          kicker="Most important"
          title="Main January"
          note="The first listed day is 22 Jan 2027. Change it if your paper is another day."
          today={desk.today}
          date={desk.settings.janDate}
          disabled={busy}
          onDate={(janDate) => {
            if (janDate) void run(() => saveSettings({ data: { ...desk.settings, janDate } }));
          }}
        />
        <ExamCard
          kicker="After January"
          title="Main April"
          note="The April day is not published yet. Set it when you know it."
          today={desk.today}
          date={desk.settings.aprilDate}
          disabled={busy}
          onDate={(aprilDate) => {
            void run(() => saveSettings({ data: { ...desk.settings, aprilDate } }));
          }}
        />
        <ExamCard
          kicker="After April"
          title="Advanced"
          note="The Advanced day is not published yet. Set it when you know it."
          today={desk.today}
          date={desk.settings.advancedDate}
          disabled={busy}
          onDate={(advancedDate) => {
            void run(() => saveSettings({ data: { ...desk.settings, advancedDate } }));
          }}
        />
      </section>

      <Plan desk={desk} busy={busy} onSave={(settings) => void run(() => saveSettings({ data: settings }))} />

      <section className="mt-3 grid gap-3 lg:grid-cols-3">
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
          className={`${quiet} mt-3 inline-flex items-center gap-2`}
          disabled={busy}
          onClick={() => void run(() => undoLastLecture())}
        >
          <Undo2 className="size-4" aria-hidden="true" />
          Undo last {desk.lastLecture.label.toLowerCase()}
        </button>
      ) : null}

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <WeakList desk={desk} busy={busy} run={run} />
        <TodoList desk={desk} busy={busy} run={run} />
      </div>

      <History history={desk.history} today={desk.today} />

      <p className="mt-6 text-sm text-muted">
        A lecture is 10 XP, including a one shot. A question is 1 XP. The streak continues with either
        one finished lecture or hitting your chosen daily question target. Questions reset at midnight IST.
      </p>
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
      <p className="text-sm text-muted">{kicker}</p>
      <p className="mt-2 font-serif text-4xl leading-none tabular-nums text-fg">
        {countdownLabel(today, date)}
      </p>
      <h2 className="mt-3 text-base font-semibold text-fg">{title}</h2>
      <p className="mt-1 text-sm text-muted">{note}</p>
      <label className="mt-4 block text-sm text-muted">
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
    <section className="mt-3 rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm text-muted">Remaining syllabus</p>
      <p className="mt-2 font-serif text-6xl leading-none tabular-nums text-fg">
        {formatHours(desk.hoursLeft)}
      </p>
      <p className="mt-2 text-muted">approximate hours still left</p>
      <p className="mt-4 text-sm text-fg tabular-nums">
        {desk.lecturesLeft} lectures left · {parts.join(" · ")}
      </p>
      <div className="mt-5 border-t border-line pt-4">
        <label className="block text-sm text-muted">
          I plan to finish the remaining syllabus on
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
          <p className="mt-3 text-sm text-fg">
            That is {desk.studyDays} {desk.studyDays === 1 ? "day" : "days"} counting today. You need{" "}
            <span className="font-semibold tabular-nums">{formatHours(desk.requiredHoursPerDay)}</span> hours
            a day to finish on {formatLong(desk.settings.targetDate)}.
          </p>
        ) : (
          <p className="mt-3 text-sm text-fg">
            {desk.hoursLeft <= 0
              ? "Nothing left on the lecture count."
              : "That finish date is already past. Pick a later day."}
          </p>
        )}
        {desk.projectedDate && desk.paceHoursPerDay !== null ? (
          <p className="mt-2 text-sm text-fg">
            At the pace you have actually kept ({formatHours(desk.paceHoursPerDay)} hours a day since you
            started logging), the remaining syllabus ends{" "}
            <span className="font-semibold">{formatLong(desk.projectedDate)}</span>
            {late && desk.daysApart !== null
              ? `, ${desk.daysApart} ${desk.daysApart === 1 ? "day" : "days"} after your target.`
              : early && desk.daysApart !== null
                ? `, ${Math.abs(desk.daysApart)} ${Math.abs(desk.daysApart) === 1 ? "day" : "days"} before your target.`
                : "."}
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">
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
      <h2 className="text-base font-semibold text-fg">{name}</h2>
      <p className="mt-3 font-serif text-5xl leading-none tabular-nums text-fg">{left}</p>
      <p className="mt-1 text-sm text-muted">lectures left · {formatHours(hours)} h</p>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-raised" aria-hidden="true">
        <div
          className="h-full bg-accent"
          style={{ width: `${total <= 0 ? 100 : Math.max(0, Math.min(100, (done / total) * 100))}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-muted tabular-nums">{done} finished since today</p>
      <p className="mt-2 text-sm text-muted">{note}</p>
      <div className="mt-4 space-y-3">
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
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-fg">{bucket.label}</p>
        <p className="text-sm tabular-nums text-muted">{bucket.remaining} left</p>
      </div>
      <p className="mt-1 text-sm text-muted tabular-nums">{formatHours(bucket.avgHours)} h average</p>
      <button
        type="button"
        className={`${primary} mt-3 w-full`}
        disabled={busy || bucket.remaining <= 0}
        onClick={() => onFinish(bucket.id)}
      >
        {bucket.remaining <= 0 ? "None left" : "Finished one · 10 XP"}
      </button>
      <button
        type="button"
        className="mt-2 text-sm text-muted underline-offset-4 hover:underline"
        onClick={() => {
          setDraft(String(bucket.remaining));
          setOpen((value) => !value);
        }}
      >
        Correct how many are left
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
            className={`${field} min-w-0`}
            inputMode="numeric"
            aria-label={`${bucket.label} left`}
            value={draft}
            onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ""))}
          />
          <button type="submit" className={quiet} disabled={busy}>
            Save
          </button>
        </form>
      ) : null}
      {open ? <p className="mt-1 text-sm text-muted">Saving a correction does not give XP.</p> : null}
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
    <div className="mt-4 border-t border-line pt-4">
      <label className="block text-sm text-muted">
        {name} questions today
        <input
          className={field}
          inputMode="numeric"
          disabled={busy}
          value={text}
          onChange={(event) => setText(event.target.value.replace(/[^\d]/g, ""))}
          onBlur={() => commit(Number(text || "0"))}
        />
      </label>
      <div className="mt-2 flex gap-2">
        <button type="button" className={quiet} disabled={busy} onClick={() => commit(todayCount + 1)}>
          +1
        </button>
        <button type="button" className={quiet} disabled={busy} onClick={() => commit(todayCount + 10)}>
          +10
        </button>
      </div>
      <p className="mt-2 text-sm text-muted tabular-nums">{trackedCount} tracked in all, from today onward</p>
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
      <h2 className="text-base font-semibold text-fg">Weak topics</h2>
      <p className="mt-1 text-sm text-muted">Add one yourself. Mark it cleared when it is no longer weak. No XP.</p>
      <form
        className="mt-4 space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          const topic = name.trim();
          if (!topic) return;
          setName("");
          void run(() => addWeakTopic({ data: { subject, name: topic } }));
        }}
      >
        <label className="block text-sm text-muted">
          Subject
          <select
            className={field}
            value={subject}
            onChange={(event) => setSubject(event.target.value as SubjectId)}
          >
            {SUBJECTS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-muted">
          Topic
          <input
            className={field}
            value={name}
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button type="submit" className={primary} disabled={busy || !name.trim()}>
          Add weak topic
        </button>
      </form>
      <ul className="mt-4 space-y-2">
        {open.length === 0 ? <li className="text-sm text-muted">None open.</li> : null}
        {open.map((topic) => (
          <li key={topic.id} className="rounded-xl bg-bg p-3">
            <p className="text-sm font-medium text-fg">{topic.name}</p>
            <p className="text-sm text-muted">{SUBJECTS.find((item) => item.id === topic.subject)?.name}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className={quiet}
                disabled={busy}
                onClick={() => void run(() => setWeakCleared({ data: { id: topic.id, cleared: true } }))}
              >
                Cleared
              </button>
              <button
                type="button"
                className="min-h-11 px-2 text-sm text-muted"
                disabled={busy}
                onClick={() => void run(() => deleteWeakTopic({ data: { id: topic.id } }))}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      {cleared.length > 0 ? (
        <details className="mt-4">
          <summary className="text-sm text-muted">Cleared ({cleared.length})</summary>
          <ul className="mt-2 space-y-2">
            {cleared.map((topic) => (
              <li key={topic.id} className="flex items-center justify-between gap-3 text-sm text-muted">
                <span className="line-through">{topic.name}</span>
                <button
                  type="button"
                  className="min-h-11 shrink-0"
                  disabled={busy}
                  onClick={() => void run(() => setWeakCleared({ data: { id: topic.id, cleared: false } }))}
                >
                  Reopen
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
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
      <h2 className="text-base font-semibold text-fg">To-do</h2>
      <p className="mt-1 text-sm text-muted">Tasks you type. Ticking one does not give XP.</p>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const text = body.trim();
          if (!text) return;
          setBody("");
          void run(() => addTodo({ data: { body: text } }));
        }}
      >
        <input
          className={field}
          value={body}
          maxLength={200}
          aria-label="New task"
          onChange={(event) => setBody(event.target.value)}
        />
        <button type="submit" className={primary} disabled={busy || !body.trim()}>
          Add
        </button>
      </form>
      <ul className="mt-4 space-y-2">
        {desk.todos.length === 0 ? <li className="text-sm text-muted">Nothing on the list.</li> : null}
        {desk.todos.map((todo) => (
          <li key={todo.id} className="flex items-center gap-3 rounded-xl bg-bg px-3 py-2">
            <input
              type="checkbox"
              className="size-5"
              checked={todo.done}
              disabled={busy}
              onChange={() => void run(() => setTodoDone({ data: { id: todo.id, done: !todo.done } }))}
              aria-label={todo.done ? `Reopen ${todo.body}` : `Done ${todo.body}`}
            />
            <span className={todo.done ? "flex-1 text-sm text-muted line-through" : "flex-1 text-sm text-fg"}>
              {todo.body}
            </span>
            <button
              type="button"
              className="min-h-11 text-sm text-muted"
              disabled={busy}
              onClick={() => void run(() => deleteTodo({ data: { id: todo.id } }))}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function History({ history, today }: { history: QuestionDay[]; today: string }) {
  return (
    <section className="mt-3 rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-base font-semibold text-fg">Questions, every day</h2>
      <p className="mt-1 text-sm text-muted">A day appears once you enter a number. Today resets at midnight IST.</p>
      {history.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Nothing entered yet.</p>
      ) : (
        <div className="mt-4 max-h-80 overflow-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2 pr-3 font-medium">Day</th>
                <th className="py-2 pr-3 font-medium">Physics</th>
                <th className="py-2 pr-3 font-medium">Chemistry</th>
                <th className="py-2 pr-3 font-medium">Maths</th>
                <th className="py-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {history.map((day) => (
                <tr key={day.day} className={day.day === today ? "text-fg" : "text-muted"}>
                  <td className="border-t border-line py-2 pr-3 tabular-nums">
                    {formatLong(day.day)}
                    {day.day === today ? " · today" : ""}
                  </td>
                  <td className="border-t border-line py-2 pr-3 tabular-nums">{day.physics}</td>
                  <td className="border-t border-line py-2 pr-3 tabular-nums">{day.chemistry}</td>
                  <td className="border-t border-line py-2 pr-3 tabular-nums">{day.maths}</td>
                  <td className="border-t border-line py-2 tabular-nums">
                    {day.physics + day.chemistry + day.maths}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

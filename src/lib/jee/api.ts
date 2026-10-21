import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { istToday, paceOf, streakFromDays } from "@/lib/jee/pace";
import type { Bucket, Desk, DeskResult, QuestionDay, SubjectId, TodoItem, WeakTopic } from "@/lib/jee/types";

const SUBJECTS: SubjectId[] = ["physics", "chemistry", "maths"];

const STARTER: Array<{
  code: string;
  subject: SubjectId;
  label: string;
  remaining: number;
  avgHours: number;
  sort: number;
}> = [
  { code: "physics", subject: "physics", label: "Lectures", remaining: 54, avgHours: 2.15, sort: 1 },
  { code: "organic", subject: "chemistry", label: "Organic", remaining: 60, avgHours: 2, sort: 2 },
  { code: "inorganic", subject: "chemistry", label: "Inorganic", remaining: 41, avgHours: 2, sort: 3 },
  { code: "maths", subject: "maths", label: "Lectures", remaining: 50, avgHours: 2.75, sort: 4 },
  { code: "oneshot", subject: "maths", label: "One shots", remaining: 3, avgHours: 8, sort: 5 },
];

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isSubject(value: string): value is SubjectId {
  return SUBJECTS.includes(value as SubjectId);
}

function cleanId(value: unknown): string {
  if (typeof value !== "string" || value.length < 4 || value.length > 200) {
    throw new Error("That item was not found.");
  }
  return value;
}

function cleanCount(value: unknown, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 0 || n > max) {
    throw new Error(`Use a whole number from 0 to ${max}.`);
  }
  return n;
}

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") throw new Error("Write something first.");
  const text = value.trim();
  if (!text) throw new Error("Write something first.");
  if (text.length > max) throw new Error(`Keep it under ${max} characters.`);
  return text;
}

function cleanDate(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} needs a real date.`);
  }
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    throw new Error(`${label} needs a real date.`);
  }
  return value;
}

function optionalDate(value: unknown, label: string): string | null {
  if (value === null || value === "") return null;
  return cleanDate(value, label);
}

type BucketRow = {
  id: string;
  subject: string;
  label: string;
  remaining: number;
  completed: number;
  avg_hours: number;
};

type DayRow = { day: string; physics: number; chemistry: number; maths: number };

type SettingsRow = {
  target_date: string;
  jan_date: string;
  april_date: string | null;
  advanced_date: string | null;
};

async function ensureSeed(userId: string) {
  const sql = await getSql();
  for (const bucket of STARTER) {
    await sql`
      insert into lecture_buckets (id, user_id, subject, label, remaining, completed, avg_hours, sort_order)
      values (
        ${`${userId}:${bucket.code}`},
        ${userId},
        ${bucket.subject},
        ${bucket.label},
        ${bucket.remaining},
        0,
        ${bucket.avgHours},
        ${bucket.sort}
      )
      on conflict (id) do nothing
    `;
  }
  await sql`
    insert into desk_settings (user_id, target_date, jan_date)
    values (${userId}, ${"2026-12-10"}, ${"2027-01-22"})
    on conflict (user_id) do nothing
  `;
}

async function readDesk(userId: string): Promise<Desk> {
  await ensureSeed(userId);
  const sql = await getSql();
  const today = istToday();

  const bucketRows = await sql<BucketRow>`
    select id, subject, label, remaining, completed, avg_hours
    from lecture_buckets
    where user_id = ${userId}
    order by sort_order asc
  `;
  const buckets: Bucket[] = bucketRows.map((row) => ({
    id: row.id,
    subject: isSubject(row.subject) ? row.subject : "physics",
    label: row.label,
    remaining: num(row.remaining),
    completed: num(row.completed),
    avgHours: num(row.avg_hours),
  }));

  const dayRows = await sql<DayRow>`
    select day, physics, chemistry, maths
    from question_days
    where user_id = ${userId}
    order by day desc
  `;
  const history: QuestionDay[] = dayRows.map((row) => ({
    day: String(row.day).slice(0, 10),
    physics: num(row.physics),
    chemistry: num(row.chemistry),
    maths: num(row.maths),
  }));
  const todayRow = history.find((row) => row.day === today);

  const settingsRows = await sql<SettingsRow>`
    select target_date, jan_date, april_date, advanced_date
    from desk_settings
    where user_id = ${userId}
  `;
  const settings = settingsRows[0];
  if (!settings) throw new Error("Your desk settings did not save.");

  const weakRows = await sql<{ id: string; subject: string; name: string; cleared: boolean }>`
    select id, subject, name, cleared
    from weak_topics
    where user_id = ${userId}
    order by cleared asc, created_at desc
  `;
  const weakTopics: WeakTopic[] = weakRows.flatMap((row) => {
    if (!isSubject(row.subject)) return [];
    return [{ id: row.id, subject: row.subject, name: row.name, cleared: Boolean(row.cleared) }];
  });

  const todoRows = await sql<{ id: string; body: string; done: boolean }>`
    select id, body, done
    from todos
    where user_id = ${userId}
    order by done asc, created_at desc
  `;
  const todos: TodoItem[] = todoRows.map((row) => ({
    id: row.id,
    body: row.body,
    done: Boolean(row.done),
  }));

  const logDays = await sql<{ day: string }>`
    select distinct day from lecture_logs where user_id = ${userId}
  `;
const qDays = await sql<{ day: string; physics: number; chemistry: number; maths: number }>`
    select day, physics, chemistry, maths
    from question_days
    where user_id = ${userId}
  `;

  // Dates with at least 1 finished lecture
  const lectureDates = logDays.map((row) => String(row.day).slice(0, 10));

  // Dates where total questions reached at least 1 (or any question activity)
  const questionDates = qDays
    .filter((row) => ((row.physics || 0) + (row.chemistry || 0) + (row.maths || 0)) >= 1)
    .map((row) => String(row.day).slice(0, 10));

  // Merge both so ANY qualifying day keeps streak safe across midnights
  const days = Array.from(new Set([...lectureDates, ...questionDates]));
  const streak = streakFromDays(days, today);

  const lastRows = await sql<{ subject: string; label: string }>`
    select b.subject, b.label
    from lecture_logs l
    join lecture_buckets b on b.id = l.bucket_id and b.user_id = l.user_id
    where l.user_id = ${userId}
    order by l.created_at desc
    limit 1
  `;
  const last = lastRows[0];
  const todayCount = await sql<{ n: number }>`
    select count(*) as n from lecture_logs where user_id = ${userId} and day = ${today}
  `;

  const hoursLeft = buckets.reduce((sum, bucket) => sum + bucket.remaining * bucket.avgHours, 0);
  const hoursDone = buckets.reduce((sum, bucket) => sum + bucket.completed * bucket.avgHours, 0);
  const lecturesLeft = buckets.reduce((sum, bucket) => sum + bucket.remaining, 0);
  const questionXp = history.reduce((sum, day) => sum + day.physics + day.chemistry + day.maths, 0);
  const pyqAttemptXpRows = await sql<{ xp: number }>`select coalesce(sum(xp_delta), 0)::int as xp from pyq_question_attempts where user_id = ${userId}`;
  const pyqAttemptXp = num(pyqAttemptXpRows[0]?.xp);
  const lectureXp = buckets.reduce((sum, bucket) => sum + bucket.completed, 0) * 10;
  const firstLectureDay = days.length ? days.slice().sort()[0] : null;
  const pace = paceOf({
    today,
    targetDate: String(settings.target_date).slice(0, 10),
    hoursLeft,
    hoursDone,
    firstLectureDay,
  });

  return {
    today,
    buckets,
    todayQuestions: {
      physics: todayRow?.physics ?? 0,
      chemistry: todayRow?.chemistry ?? 0,
      maths: todayRow?.maths ?? 0,
    },
    history,
    streak: streak.streak,
    streakAliveToday: streak.aliveToday,
    xp: questionXp + lectureXp + pyqAttemptXp,
    lecturesLeft,
    hoursLeft,
    hoursDone,
    studyDays: pace.studyDays,
    requiredHoursPerDay: pace.requiredHoursPerDay,
    paceHoursPerDay: pace.paceHoursPerDay,
    projectedDate: pace.projectedDate,
    daysApart: pace.daysApart,
    settings: {
      targetDate: String(settings.target_date).slice(0, 10),
      janDate: String(settings.jan_date).slice(0, 10),
      aprilDate: settings.april_date ? String(settings.april_date).slice(0, 10) : null,
      advancedDate: settings.advanced_date ? String(settings.advanced_date).slice(0, 10) : null,
    },
    weakTopics,
    todos,
    lastLecture: last && isSubject(last.subject) ? { subject: last.subject, label: last.label } : null,
    todayLectures: num(todayCount[0]?.n),
  };
}

async function result(userId: string, reward: DeskResult["reward"]): Promise<DeskResult> {
  return { desk: await readDesk(userId), reward };
}

export const getDesk = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => result(context.userId, null));

export const finishLecture = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { bucketId: string }) => ({ bucketId: cleanId(input?.bucketId) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{ label: string }>`
      update lecture_buckets
      set remaining = remaining - 1, completed = completed + 1
      where id = ${data.bucketId} and user_id = ${context.userId} and remaining > 0
      returning label
    `;
    if (!rows[0]) throw new Error("Nothing left in that group.");
    await sql`
      insert into lecture_logs (id, user_id, bucket_id, day)
      values (${crypto.randomUUID()}, ${context.userId}, ${data.bucketId}, ${istToday()})
    `;
    return result(context.userId, { xp: 10, label: rows[0].label });
  });

export const undoLastLecture = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{ id: string; bucket_id: string; label: string }>`
      select l.id, l.bucket_id, b.label
      from lecture_logs l
      join lecture_buckets b on b.id = l.bucket_id and b.user_id = l.user_id
      where l.user_id = ${context.userId}
      order by l.created_at desc
      limit 1
    `;
    const last = rows[0];
    if (!last) throw new Error("No lecture to undo.");
    await sql`
      update lecture_buckets
      set remaining = remaining + 1, completed = greatest(completed - 1, 0)
      where id = ${last.bucket_id} and user_id = ${context.userId}
    `;
    await sql`delete from lecture_logs where id = ${last.id} and user_id = ${context.userId}`;
    return result(context.userId, { xp: -10, label: `Undid ${last.label}` });
  });

export const setRemaining = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { bucketId: string; remaining: number }) => ({
    bucketId: cleanId(input?.bucketId),
    remaining: cleanCount(input?.remaining, 500),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql`
      update lecture_buckets
      set remaining = ${data.remaining}
      where id = ${data.bucketId} and user_id = ${context.userId}
      returning id
    `;
    if (!rows[0]) throw new Error("That lecture group was not found.");
    return result(context.userId, null);
  });

export const setTodayQuestions = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { subject: SubjectId; count: number }) => {
    if (!input || !isSubject(input.subject)) throw new Error("Pick a subject.");
    return { subject: input.subject, count: cleanCount(input.count, 2000) };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const today = istToday();
    const before = await sql<DayRow>`
      select day, physics, chemistry, maths
      from question_days
      where user_id = ${context.userId} and day = ${today}
    `;
    const previous = num(before[0]?.[data.subject]);
    if (data.subject === "physics") {
      await sql`
        insert into question_days (user_id, day, physics, chemistry, maths)
        values (${context.userId}, ${today}, ${data.count}, 0, 0)
        on conflict (user_id, day) do update set physics = excluded.physics
      `;
    } else if (data.subject === "chemistry") {
      await sql`
        insert into question_days (user_id, day, physics, chemistry, maths)
        values (${context.userId}, ${today}, 0, ${data.count}, 0)
        on conflict (user_id, day) do update set chemistry = excluded.chemistry
      `;
    } else {
      await sql`
        insert into question_days (user_id, day, physics, chemistry, maths)
        values (${context.userId}, ${today}, 0, 0, ${data.count})
        on conflict (user_id, day) do update set maths = excluded.maths
      `;
    }
    const delta = data.count - previous;
    return result(
      context.userId,
      delta === 0 ? null : { xp: delta, label: delta > 0 ? "Questions" : "Questions corrected" },
    );
  });

export const addWeakTopic = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { subject: SubjectId; name: string }) => {
    if (!input || !isSubject(input.subject)) throw new Error("Pick a subject.");
    return { subject: input.subject, name: cleanText(input.name, 120) };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      insert into weak_topics (id, user_id, subject, name)
      values (${crypto.randomUUID()}, ${context.userId}, ${data.subject}, ${data.name})
    `;
    return result(context.userId, null);
  });

export const setWeakCleared = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; cleared: boolean }) => ({
    id: cleanId(input?.id),
    cleared: Boolean(input?.cleared),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      update weak_topics
      set cleared = ${data.cleared}
      where id = ${data.id} and user_id = ${context.userId}
    `;
    return result(context.userId, null);
  });

export const deleteWeakTopic = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: cleanId(input?.id) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`delete from weak_topics where id = ${data.id} and user_id = ${context.userId}`;
    return result(context.userId, null);
  });

export const addTodo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { body: string }) => ({ body: cleanText(input?.body, 200) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      insert into todos (id, user_id, body)
      values (${crypto.randomUUID()}, ${context.userId}, ${data.body})
    `;
    return result(context.userId, null);
  });

export const setTodoDone = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; done: boolean }) => ({
    id: cleanId(input?.id),
    done: Boolean(input?.done),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      update todos set done = ${data.done}
      where id = ${data.id} and user_id = ${context.userId}
    `;
    return result(context.userId, null);
  });

export const deleteTodo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: cleanId(input?.id) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`delete from todos where id = ${data.id} and user_id = ${context.userId}`;
    return result(context.userId, null);
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      targetDate: string;
      janDate: string;
      aprilDate: string | null;
      advancedDate: string | null;
    }) => ({
      targetDate: cleanDate(input?.targetDate, "Finish date"),
      janDate: cleanDate(input?.janDate, "January date"),
      aprilDate: optionalDate(input?.aprilDate, "April date"),
      advancedDate: optionalDate(input?.advancedDate, "Advanced date"),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      update desk_settings
      set target_date = ${data.targetDate},
          jan_date = ${data.janDate},
          april_date = ${data.aprilDate},
          advanced_date = ${data.advancedDate}
      where user_id = ${context.userId}
    `;
    return result(context.userId, null);
  });

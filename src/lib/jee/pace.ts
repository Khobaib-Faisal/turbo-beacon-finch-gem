export function istToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** Days you can still study, including today. 0 if the target is already past. */
export function studyDaysUntil(today: string, target: string): number {
  const diff = daysBetween(today, target);
  if (diff < 0) return 0;
  return diff + 1;
}

export function formatLong(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatHours(n: number): string {
  const rounded = Math.round((n + Number.EPSILON) * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  const text = rounded.toFixed(2);
  return text.endsWith("0") ? text.slice(0, -1) : text;
}

export type PaceInput = {
  today: string;
  targetDate: string;
  hoursLeft: number;
  hoursDone: number;
  firstLectureDay: string | null;
};

export type PaceResult = {
  studyDays: number;
  requiredHoursPerDay: number | null;
  paceHoursPerDay: number | null;
  projectedDate: string | null;
  /** Positive means the pace date is after the target. */
  daysApart: number | null;
};

export function paceOf(input: PaceInput): PaceResult {
  const studyDays = studyDaysUntil(input.today, input.targetDate);
  const requiredHoursPerDay =
    input.hoursLeft <= 0 ? 0 : studyDays > 0 ? input.hoursLeft / studyDays : null;

  if (input.hoursDone <= 0 || !input.firstLectureDay) {
    return {
      studyDays,
      requiredHoursPerDay,
      paceHoursPerDay: null,
      projectedDate: null,
      daysApart: null,
    };
  }

  const elapsed = Math.max(1, daysBetween(input.firstLectureDay, input.today) + 1);
  const paceHoursPerDay = input.hoursDone / elapsed;
  if (input.hoursLeft <= 0) {
    return {
      studyDays,
      requiredHoursPerDay,
      paceHoursPerDay,
      projectedDate: input.today,
      daysApart: daysBetween(input.targetDate, input.today),
    };
  }
  const projectedDate = addDays(input.today, Math.ceil(input.hoursLeft / paceHoursPerDay));
  return {
    studyDays,
    requiredHoursPerDay,
    paceHoursPerDay,
    projectedDate,
    daysApart: daysBetween(input.targetDate, projectedDate),
  };
}

export function streakFromDays(days: string[], today: string): { streak: number; aliveToday: boolean } {
  const set = new Set(days);
  const aliveToday = set.has(today);
  let cursor = aliveToday ? today : addDays(today, -1);
  if (!set.has(cursor)) return { streak: 0, aliveToday };
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return { streak, aliveToday };
}

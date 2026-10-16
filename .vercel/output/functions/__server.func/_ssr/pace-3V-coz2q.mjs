import { n as createMiddleware } from "./ssr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/pace-3V-coz2q.js
/**
* Auth middleware for server functions — the standard way to get the caller's
* verified user id. When deployed the session cookie is same-origin and rides
* along automatically. In the live preview the client also forwards the bearer
* token (partitioned cookies) via the `.client` hook below — call sites do not
* thread it themselves.
*
*   import { createServerFn } from "@tanstack/react-start";
*   import { getSql } from "@/lib/db";
*   import { authMiddleware } from "@/lib/auth/middleware";
*
*   export const listTodos = createServerFn({ method: "GET" })
*     .middleware([authMiddleware])
*     .handler(async ({ context }) => {
*       const sql = await getSql();
*       return sql`select * from todos where user_id = ${context.userId}`;
*     });
*
* Signed out with auth on (live preview included) -> throws `UnauthorizedError`
* (see `verify.server.ts`). With auth disabled (`VITE_AUTH_ENABLED=false`, the
* shipped default) it resolves the shared dev user — but throws instead when a
* `DATABASE_URL` is also set, so an app without sign-in must not use this at
* all. On the auth-on path, use it on every server function that touches
* per-user data and scope every query by `context.userId`.
*/
var authMiddleware = createMiddleware({ type: "function" }).client(async ({ next }) => {
	const { getBearerToken } = await import("./client-1vAx-gM_.mjs").then((n) => n.n).then((n) => n.n);
	return next({ sendContext: { bearerToken: getBearerToken() ?? void 0 } });
}).server(async ({ next, context }) => {
	const { assertSameSiteRequest } = await import("./isolation.server-CGNg1r0B.mjs");
	const { requireUserId } = await import("./verify.server-D0FayRZ1.mjs");
	assertSameSiteRequest();
	return next({ context: { userId: await requireUserId(context.bearerToken) } });
});
function istToday(now = /* @__PURE__ */ new Date()) {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Kolkata",
		year: "numeric",
		month: "2-digit",
		day: "2-digit"
	}).format(now);
}
function addDays(iso, days) {
	const [y, m, d] = iso.split("-").map(Number);
	const dt = new Date(Date.UTC(y, m - 1, d + days));
	return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}
function daysBetween(from, to) {
	const [y1, m1, d1] = from.split("-").map(Number);
	const [y2, m2, d2] = to.split("-").map(Number);
	return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 864e5);
}
/** Days you can still study, including today. 0 if the target is already past. */
function studyDaysUntil(today, target) {
	const diff = daysBetween(today, target);
	if (diff < 0) return 0;
	return diff + 1;
}
function formatLong(iso) {
	const [y, m, d] = iso.split("-").map(Number);
	return new Intl.DateTimeFormat("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "UTC"
	}).format(new Date(Date.UTC(y, m - 1, d)));
}
function formatHours(n) {
	const rounded = Math.round((n + Number.EPSILON) * 100) / 100;
	if (Number.isInteger(rounded)) return String(rounded);
	const text = rounded.toFixed(2);
	return text.endsWith("0") ? text.slice(0, -1) : text;
}
function paceOf(input) {
	const studyDays = studyDaysUntil(input.today, input.targetDate);
	const requiredHoursPerDay = input.hoursLeft <= 0 ? 0 : studyDays > 0 ? input.hoursLeft / studyDays : null;
	if (input.hoursDone <= 0 || !input.firstLectureDay) return {
		studyDays,
		requiredHoursPerDay,
		paceHoursPerDay: null,
		projectedDate: null,
		daysApart: null
	};
	const elapsed = Math.max(1, daysBetween(input.firstLectureDay, input.today) + 1);
	const paceHoursPerDay = input.hoursDone / elapsed;
	if (input.hoursLeft <= 0) return {
		studyDays,
		requiredHoursPerDay,
		paceHoursPerDay,
		projectedDate: input.today,
		daysApart: daysBetween(input.targetDate, input.today)
	};
	const projectedDate = addDays(input.today, Math.ceil(input.hoursLeft / paceHoursPerDay));
	return {
		studyDays,
		requiredHoursPerDay,
		paceHoursPerDay,
		projectedDate,
		daysApart: daysBetween(input.targetDate, projectedDate)
	};
}
function streakFromDays(days, today) {
	const set = new Set(days);
	const aliveToday = set.has(today);
	let cursor = aliveToday ? today : addDays(today, -1);
	if (!set.has(cursor)) return {
		streak: 0,
		aliveToday
	};
	let streak = 0;
	while (set.has(cursor)) {
		streak += 1;
		cursor = addDays(cursor, -1);
	}
	return {
		streak,
		aliveToday
	};
}
//#endregion
export { istToday as a, formatLong as i, daysBetween as n, paceOf as o, formatHours as r, streakFromDays as s, authMiddleware as t };

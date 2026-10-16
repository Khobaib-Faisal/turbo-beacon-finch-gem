import { i as TSS_SERVER_FUNCTION, r as createServerFn } from "./ssr.mjs";
import { r as getSql } from "./db-aShqfmAq.mjs";
import { a as istToday, o as paceOf, s as streakFromDays, t as authMiddleware } from "./pace-3V-coz2q.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/api-kpg56iBE.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var SUBJECTS = [
	"physics",
	"chemistry",
	"maths"
];
var STARTER = [
	{
		code: "physics",
		subject: "physics",
		label: "Lectures",
		remaining: 54,
		avgHours: 2.15,
		sort: 1
	},
	{
		code: "organic",
		subject: "chemistry",
		label: "Organic",
		remaining: 60,
		avgHours: 2,
		sort: 2
	},
	{
		code: "inorganic",
		subject: "chemistry",
		label: "Inorganic",
		remaining: 41,
		avgHours: 2,
		sort: 3
	},
	{
		code: "maths",
		subject: "maths",
		label: "Lectures",
		remaining: 50,
		avgHours: 2.75,
		sort: 4
	},
	{
		code: "oneshot",
		subject: "maths",
		label: "One shots",
		remaining: 3,
		avgHours: 8,
		sort: 5
	}
];
function num(value) {
	const n = typeof value === "number" ? value : Number(value);
	return Number.isFinite(n) ? n : 0;
}
function isSubject(value) {
	return SUBJECTS.includes(value);
}
function cleanId(value) {
	if (typeof value !== "string" || value.length < 4 || value.length > 200) throw new Error("That item was not found.");
	return value;
}
function cleanCount(value, max) {
	const n = typeof value === "number" ? value : Number(value);
	if (!Number.isInteger(n) || n < 0 || n > max) throw new Error(`Use a whole number from 0 to ${max}.`);
	return n;
}
function cleanText(value, max) {
	if (typeof value !== "string") throw new Error("Write something first.");
	const text = value.trim();
	if (!text) throw new Error("Write something first.");
	if (text.length > max) throw new Error(`Keep it under ${max} characters.`);
	return text;
}
function cleanDate(value, label) {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} needs a real date.`);
	const [y, m, d] = value.split("-").map(Number);
	const dt = new Date(Date.UTC(y, m - 1, d));
	if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) throw new Error(`${label} needs a real date.`);
	return value;
}
function optionalDate(value, label) {
	if (value === null || value === "") return null;
	return cleanDate(value, label);
}
async function ensureSeed(userId) {
	const sql = await getSql();
	for (const bucket of STARTER) await sql`
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
	await sql`
    insert into desk_settings (user_id, target_date, jan_date)
    values (${userId}, ${"2026-12-10"}, ${"2027-01-22"})
    on conflict (user_id) do nothing
  `;
}
async function readDesk(userId) {
	await ensureSeed(userId);
	const sql = await getSql();
	const today = istToday();
	const buckets = (await sql`
    select id, subject, label, remaining, completed, avg_hours
    from lecture_buckets
    where user_id = ${userId}
    order by sort_order asc
  `).map((row) => ({
		id: row.id,
		subject: isSubject(row.subject) ? row.subject : "physics",
		label: row.label,
		remaining: num(row.remaining),
		completed: num(row.completed),
		avgHours: num(row.avg_hours)
	}));
	const history = (await sql`
    select day, physics, chemistry, maths
    from question_days
    where user_id = ${userId}
    order by day desc
  `).map((row) => ({
		day: String(row.day).slice(0, 10),
		physics: num(row.physics),
		chemistry: num(row.chemistry),
		maths: num(row.maths)
	}));
	const todayRow = history.find((row) => row.day === today);
	const settings = (await sql`
    select target_date, jan_date, april_date, advanced_date
    from desk_settings
    where user_id = ${userId}
  `)[0];
	if (!settings) throw new Error("Your desk settings did not save.");
	const weakTopics = (await sql`
    select id, subject, name, cleared
    from weak_topics
    where user_id = ${userId}
    order by cleared asc, created_at desc
  `).flatMap((row) => {
		if (!isSubject(row.subject)) return [];
		return [{
			id: row.id,
			subject: row.subject,
			name: row.name,
			cleared: Boolean(row.cleared)
		}];
	});
	const todos = (await sql`
    select id, body, done
    from todos
    where user_id = ${userId}
    order by done asc, created_at desc
  `).map((row) => ({
		id: row.id,
		body: row.body,
		done: Boolean(row.done)
	}));
	const days = (await sql`
    select distinct day from lecture_logs where user_id = ${userId}
  `).map((row) => String(row.day).slice(0, 10));
	const streak = streakFromDays(days, today);
	const last = (await sql`
    select b.subject, b.label
    from lecture_logs l
    join lecture_buckets b on b.id = l.bucket_id and b.user_id = l.user_id
    where l.user_id = ${userId}
    order by l.created_at desc
    limit 1
  `)[0];
	const todayCount = await sql`
    select count(*) as n from lecture_logs where user_id = ${userId} and day = ${today}
  `;
	const hoursLeft = buckets.reduce((sum, bucket) => sum + bucket.remaining * bucket.avgHours, 0);
	const hoursDone = buckets.reduce((sum, bucket) => sum + bucket.completed * bucket.avgHours, 0);
	const lecturesLeft = buckets.reduce((sum, bucket) => sum + bucket.remaining, 0);
	const questionXp = history.reduce((sum, day) => sum + day.physics + day.chemistry + day.maths, 0);
	const lectureXp = buckets.reduce((sum, bucket) => sum + bucket.completed, 0) * 10;
	const firstLectureDay = days.length ? days.slice().sort()[0] : null;
	const pace = paceOf({
		today,
		targetDate: String(settings.target_date).slice(0, 10),
		hoursLeft,
		hoursDone,
		firstLectureDay
	});
	return {
		today,
		buckets,
		todayQuestions: {
			physics: todayRow?.physics ?? 0,
			chemistry: todayRow?.chemistry ?? 0,
			maths: todayRow?.maths ?? 0
		},
		history,
		streak: streak.streak,
		streakAliveToday: streak.aliveToday,
		xp: questionXp + lectureXp,
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
			advancedDate: settings.advanced_date ? String(settings.advanced_date).slice(0, 10) : null
		},
		weakTopics,
		todos,
		lastLecture: last && isSubject(last.subject) ? {
			subject: last.subject,
			label: last.label
		} : null,
		todayLectures: num(todayCount[0]?.n)
	};
}
async function result(userId, reward) {
	return {
		desk: await readDesk(userId),
		reward
	};
}
var getDesk_createServerFn_handler = createServerRpc({
	id: "827b18d71f94c0c1aaa0b22a5940162ea6be24ae33d71f266714fea26d3369f9",
	name: "getDesk",
	filename: "src/lib/jee/api.ts"
}, (opts) => getDesk.__executeServer(opts));
var getDesk = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getDesk_createServerFn_handler, async ({ context }) => result(context.userId, null));
var finishLecture_createServerFn_handler = createServerRpc({
	id: "b93bebffffc78377f48acf1edaedcd300ce39545f41da805abb8f019270e4de4",
	name: "finishLecture",
	filename: "src/lib/jee/api.ts"
}, (opts) => finishLecture.__executeServer(opts));
var finishLecture = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ bucketId: cleanId(input?.bucketId) })).handler(finishLecture_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	const rows = await sql`
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
	return result(context.userId, {
		xp: 10,
		label: rows[0].label
	});
});
var undoLastLecture_createServerFn_handler = createServerRpc({
	id: "7b00eba5925322b7bbbe97e7f85bac785dc19b2c8b1d4d293b0da1593e820e77",
	name: "undoLastLecture",
	filename: "src/lib/jee/api.ts"
}, (opts) => undoLastLecture.__executeServer(opts));
var undoLastLecture = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(undoLastLecture_createServerFn_handler, async ({ context }) => {
	const sql = await getSql();
	const last = (await sql`
      select l.id, l.bucket_id, b.label
      from lecture_logs l
      join lecture_buckets b on b.id = l.bucket_id and b.user_id = l.user_id
      where l.user_id = ${context.userId}
      order by l.created_at desc
      limit 1
    `)[0];
	if (!last) throw new Error("No lecture to undo.");
	await sql`
      update lecture_buckets
      set remaining = remaining + 1, completed = greatest(completed - 1, 0)
      where id = ${last.bucket_id} and user_id = ${context.userId}
    `;
	await sql`delete from lecture_logs where id = ${last.id} and user_id = ${context.userId}`;
	return result(context.userId, {
		xp: -10,
		label: `Undid ${last.label}`
	});
});
var setRemaining_createServerFn_handler = createServerRpc({
	id: "b78e1f55336e568a66990d68c406b011e4347acc7e1ac50883290ac67e890fe0",
	name: "setRemaining",
	filename: "src/lib/jee/api.ts"
}, (opts) => setRemaining.__executeServer(opts));
var setRemaining = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	bucketId: cleanId(input?.bucketId),
	remaining: cleanCount(input?.remaining, 500)
})).handler(setRemaining_createServerFn_handler, async ({ context, data }) => {
	if (!(await (await getSql())`
      update lecture_buckets
      set remaining = ${data.remaining}
      where id = ${data.bucketId} and user_id = ${context.userId}
      returning id
    `)[0]) throw new Error("That lecture group was not found.");
	return result(context.userId, null);
});
var setTodayQuestions_createServerFn_handler = createServerRpc({
	id: "85fecbdba558b92922adf537c9487d50ca263b456cfd25ef41cfcd9dbf62ef3f",
	name: "setTodayQuestions",
	filename: "src/lib/jee/api.ts"
}, (opts) => setTodayQuestions.__executeServer(opts));
var setTodayQuestions = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => {
	if (!input || !isSubject(input.subject)) throw new Error("Pick a subject.");
	return {
		subject: input.subject,
		count: cleanCount(input.count, 2e3)
	};
}).handler(setTodayQuestions_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	const today = istToday();
	const previous = num((await sql`
      select day, physics, chemistry, maths
      from question_days
      where user_id = ${context.userId} and day = ${today}
    `)[0]?.[data.subject]);
	if (data.subject === "physics") await sql`
        insert into question_days (user_id, day, physics, chemistry, maths)
        values (${context.userId}, ${today}, ${data.count}, 0, 0)
        on conflict (user_id, day) do update set physics = excluded.physics
      `;
	else if (data.subject === "chemistry") await sql`
        insert into question_days (user_id, day, physics, chemistry, maths)
        values (${context.userId}, ${today}, 0, ${data.count}, 0)
        on conflict (user_id, day) do update set chemistry = excluded.chemistry
      `;
	else await sql`
        insert into question_days (user_id, day, physics, chemistry, maths)
        values (${context.userId}, ${today}, 0, 0, ${data.count})
        on conflict (user_id, day) do update set maths = excluded.maths
      `;
	const delta = data.count - previous;
	return result(context.userId, delta === 0 ? null : {
		xp: delta,
		label: delta > 0 ? "Questions" : "Questions corrected"
	});
});
var addWeakTopic_createServerFn_handler = createServerRpc({
	id: "e8ef8b8a830ae2adfa6f1d3d62c0343743ae03bc53c978efdbe5bc618a75e08e",
	name: "addWeakTopic",
	filename: "src/lib/jee/api.ts"
}, (opts) => addWeakTopic.__executeServer(opts));
var addWeakTopic = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => {
	if (!input || !isSubject(input.subject)) throw new Error("Pick a subject.");
	return {
		subject: input.subject,
		name: cleanText(input.name, 120)
	};
}).handler(addWeakTopic_createServerFn_handler, async ({ context, data }) => {
	await (await getSql())`
      insert into weak_topics (id, user_id, subject, name)
      values (${crypto.randomUUID()}, ${context.userId}, ${data.subject}, ${data.name})
    `;
	return result(context.userId, null);
});
var setWeakCleared_createServerFn_handler = createServerRpc({
	id: "f8ad3277215304a11bbf20c31b2a30e300dc1f49b11786df820ffebab4f895a0",
	name: "setWeakCleared",
	filename: "src/lib/jee/api.ts"
}, (opts) => setWeakCleared.__executeServer(opts));
var setWeakCleared = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	id: cleanId(input?.id),
	cleared: Boolean(input?.cleared)
})).handler(setWeakCleared_createServerFn_handler, async ({ context, data }) => {
	await (await getSql())`
      update weak_topics
      set cleared = ${data.cleared}
      where id = ${data.id} and user_id = ${context.userId}
    `;
	return result(context.userId, null);
});
var deleteWeakTopic_createServerFn_handler = createServerRpc({
	id: "2891f502b350c954cf1d2dd5a85c0650444d65441edd8a76804fa77846c1afee",
	name: "deleteWeakTopic",
	filename: "src/lib/jee/api.ts"
}, (opts) => deleteWeakTopic.__executeServer(opts));
var deleteWeakTopic = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ id: cleanId(input?.id) })).handler(deleteWeakTopic_createServerFn_handler, async ({ context, data }) => {
	await (await getSql())`delete from weak_topics where id = ${data.id} and user_id = ${context.userId}`;
	return result(context.userId, null);
});
var addTodo_createServerFn_handler = createServerRpc({
	id: "abaa1648faea6e2add07329995b4949fb3e9d1fc96802dd6d5cf3a21d66fa46e",
	name: "addTodo",
	filename: "src/lib/jee/api.ts"
}, (opts) => addTodo.__executeServer(opts));
var addTodo = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ body: cleanText(input?.body, 200) })).handler(addTodo_createServerFn_handler, async ({ context, data }) => {
	await (await getSql())`
      insert into todos (id, user_id, body)
      values (${crypto.randomUUID()}, ${context.userId}, ${data.body})
    `;
	return result(context.userId, null);
});
var setTodoDone_createServerFn_handler = createServerRpc({
	id: "5ed7642a43716a92be542d6a3d21c54f1215cbc28a51d11af25e94625185d681",
	name: "setTodoDone",
	filename: "src/lib/jee/api.ts"
}, (opts) => setTodoDone.__executeServer(opts));
var setTodoDone = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	id: cleanId(input?.id),
	done: Boolean(input?.done)
})).handler(setTodoDone_createServerFn_handler, async ({ context, data }) => {
	await (await getSql())`
      update todos set done = ${data.done}
      where id = ${data.id} and user_id = ${context.userId}
    `;
	return result(context.userId, null);
});
var deleteTodo_createServerFn_handler = createServerRpc({
	id: "a3f12724a5bbc232fc75b2642b2a5ecf043b1a0b62554ea887b3f174a60dd7b7",
	name: "deleteTodo",
	filename: "src/lib/jee/api.ts"
}, (opts) => deleteTodo.__executeServer(opts));
var deleteTodo = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ id: cleanId(input?.id) })).handler(deleteTodo_createServerFn_handler, async ({ context, data }) => {
	await (await getSql())`delete from todos where id = ${data.id} and user_id = ${context.userId}`;
	return result(context.userId, null);
});
var saveSettings_createServerFn_handler = createServerRpc({
	id: "156c2748b0c9496112d2312b7ffc3c74b3e5ebe29997fe34e73026d776866b2b",
	name: "saveSettings",
	filename: "src/lib/jee/api.ts"
}, (opts) => saveSettings.__executeServer(opts));
var saveSettings = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	targetDate: cleanDate(input?.targetDate, "Finish date"),
	janDate: cleanDate(input?.janDate, "January date"),
	aprilDate: optionalDate(input?.aprilDate, "April date"),
	advancedDate: optionalDate(input?.advancedDate, "Advanced date")
})).handler(saveSettings_createServerFn_handler, async ({ context, data }) => {
	await (await getSql())`
      update desk_settings
      set target_date = ${data.targetDate},
          jan_date = ${data.janDate},
          april_date = ${data.aprilDate},
          advanced_date = ${data.advancedDate}
      where user_id = ${context.userId}
    `;
	return result(context.userId, null);
});
//#endregion
export { addTodo_createServerFn_handler, addWeakTopic_createServerFn_handler, deleteTodo_createServerFn_handler, deleteWeakTopic_createServerFn_handler, finishLecture_createServerFn_handler, getDesk_createServerFn_handler, saveSettings_createServerFn_handler, setRemaining_createServerFn_handler, setTodayQuestions_createServerFn_handler, setTodoDone_createServerFn_handler, setWeakCleared_createServerFn_handler, undoLastLecture_createServerFn_handler };

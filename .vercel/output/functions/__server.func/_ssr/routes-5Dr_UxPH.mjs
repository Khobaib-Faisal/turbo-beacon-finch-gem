import { o as __toESM } from "../_runtime.mjs";
import { J as require_react, x as require_jsx_runtime, y as Navigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as getServerFnById, i as TSS_SERVER_FUNCTION, r as createServerFn } from "./ssr.mjs";
import { i as formatLong, n as daysBetween, r as formatHours, t as authMiddleware } from "./pace-3V-coz2q.mjs";
import { i as signOut } from "./client-1vAx-gM_.mjs";
import { a as hasGateSessionMarker } from "./server-DZCv2bc8.mjs";
import { i as useCurrentUserState, n as SignInPanel, r as useCurrentUser, t as ShellSkeleton } from "./sign-in-panel-vlX8SqnW.mjs";
import { r as Flame, t as Undo2 } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-5Dr_UxPH.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var subscribeToNothing = () => () => {};
var noGateSessionOnServer = () => false;
/**
* Auth state components — plain wrappers around `useCurrentUserState()`.
*
* With auth on, visitors are signed out until they authenticate — in the sandbox
* live preview too, which does real sign-in. The shared dev user appears only
* when auth is disabled (`VITE_AUTH_ENABLED=false`, the shipped default).
* While the session is still resolving, gates that care about signed-out state
* render nothing so there's no signed-out flash on hard reload.
*/
/** Where `RedirectToSignIn` sends signed-out visitors. Create this route. */
var SIGN_IN_PATH = "/login";
/**
* Client-side redirect to the sign-in route (TanStack `<Navigate>` — NOT a full
* `window.location` reload). A hard navigation re-bootstraps the SPA and re-runs
* session loading, which feels like a second "Loading…" on /login.
*
* Guard routes by waiting out `isPending` first (see `use-current-user`), then
* render this.
*/
function RedirectToSignIn({ to = SIGN_IN_PATH }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigate, { to });
}
/**
* Minimal signed-in identity chip + sign-out. Restyle freely (see the
* `design-ui` skill). Sign-out is only shown when auth is enabled (the
* disabled-auth dev user has nothing to sign out of) and the session is not
* gate-materialized — behind the gate the next request signs the viewer
* straight back in, so a sign-out control there is a broken loop.
*/
function UserButton() {
	const user = useCurrentUser();
	const [signingOut, setSigningOut] = (0, import_react.useState)(false);
	const gateSession = (0, import_react.useSyncExternalStore)(subscribeToNothing, hasGateSessionMarker, noGateSessionOnServer);
	if (!user) return null;
	const label = user.displayName ?? user.primaryEmail ?? "Account";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2",
		children: [
			user.profileImageUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: user.profileImageUrl,
				alt: "",
				className: "h-8 w-8 rounded-full object-cover"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "grid h-8 w-8 place-items-center rounded-full bg-black/10 text-sm font-medium dark:bg-white/20",
				children: label.charAt(0).toUpperCase()
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-sm font-medium",
				children: label
			}),
			!gateSession && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				disabled: signingOut,
				onClick: () => {
					setSigningOut(true);
					signOut().catch(() => setSigningOut(false));
				},
				className: "cursor-pointer text-sm underline-offset-4 opacity-70 hover:underline disabled:cursor-wait disabled:no-underline",
				children: signingOut ? "Signing out…" : "Sign out"
			})
		]
	});
}
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var SUBJECTS$1 = [
	"physics",
	"chemistry",
	"maths"
];
function isSubject(value) {
	return SUBJECTS$1.includes(value);
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
var getDesk = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("827b18d71f94c0c1aaa0b22a5940162ea6be24ae33d71f266714fea26d3369f9"));
var finishLecture = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ bucketId: cleanId(input?.bucketId) })).handler(createSsrRpc("b93bebffffc78377f48acf1edaedcd300ce39545f41da805abb8f019270e4de4"));
var undoLastLecture = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(createSsrRpc("7b00eba5925322b7bbbe97e7f85bac785dc19b2c8b1d4d293b0da1593e820e77"));
var setRemaining = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	bucketId: cleanId(input?.bucketId),
	remaining: cleanCount(input?.remaining, 500)
})).handler(createSsrRpc("b78e1f55336e568a66990d68c406b011e4347acc7e1ac50883290ac67e890fe0"));
var setTodayQuestions = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => {
	if (!input || !isSubject(input.subject)) throw new Error("Pick a subject.");
	return {
		subject: input.subject,
		count: cleanCount(input.count, 2e3)
	};
}).handler(createSsrRpc("85fecbdba558b92922adf537c9487d50ca263b456cfd25ef41cfcd9dbf62ef3f"));
var addWeakTopic = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => {
	if (!input || !isSubject(input.subject)) throw new Error("Pick a subject.");
	return {
		subject: input.subject,
		name: cleanText(input.name, 120)
	};
}).handler(createSsrRpc("e8ef8b8a830ae2adfa6f1d3d62c0343743ae03bc53c978efdbe5bc618a75e08e"));
var setWeakCleared = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	id: cleanId(input?.id),
	cleared: Boolean(input?.cleared)
})).handler(createSsrRpc("f8ad3277215304a11bbf20c31b2a30e300dc1f49b11786df820ffebab4f895a0"));
var deleteWeakTopic = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ id: cleanId(input?.id) })).handler(createSsrRpc("2891f502b350c954cf1d2dd5a85c0650444d65441edd8a76804fa77846c1afee"));
var addTodo = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ body: cleanText(input?.body, 200) })).handler(createSsrRpc("abaa1648faea6e2add07329995b4949fb3e9d1fc96802dd6d5cf3a21d66fa46e"));
var setTodoDone = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	id: cleanId(input?.id),
	done: Boolean(input?.done)
})).handler(createSsrRpc("5ed7642a43716a92be542d6a3d21c54f1215cbc28a51d11af25e94625185d681"));
var deleteTodo = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ id: cleanId(input?.id) })).handler(createSsrRpc("a3f12724a5bbc232fc75b2642b2a5ecf043b1a0b62554ea887b3f174a60dd7b7"));
var saveSettings = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	targetDate: cleanDate(input?.targetDate, "Finish date"),
	janDate: cleanDate(input?.janDate, "January date"),
	aprilDate: optionalDate(input?.aprilDate, "April date"),
	advancedDate: optionalDate(input?.advancedDate, "Advanced date")
})).handler(createSsrRpc("156c2748b0c9496112d2312b7ffc3c74b3e5ebe29997fe34e73026d776866b2b"));
var field = "mt-1 w-full min-h-11 rounded-xl border border-line bg-bg px-3 text-base text-fg outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
var primary = "min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-40";
var quiet = "min-h-11 rounded-xl border border-line bg-raised px-4 text-sm font-medium text-fg disabled:opacity-40";
var SUBJECTS = [
	{
		id: "physics",
		name: "Physics",
		note: "Average length 2.15 hours."
	},
	{
		id: "chemistry",
		name: "Chemistry",
		note: "Organic and inorganic only. Physical is already done, so it is not counted. Average 2 hours."
	},
	{
		id: "maths",
		name: "Mathematics",
		note: "Lectures average 2.75 hours. One shots average 8 hours. A one shot still counts as one lecture."
	}
];
function messageOf(err) {
	if (err instanceof Error && err.message) return err.message;
	if (typeof err === "object" && err && "message" in err && typeof err.message === "string") return err.message;
	return "Something failed. Try again.";
}
function countdownLabel(today, date) {
	if (!date) return "Not set";
	const n = daysBetween(today, date);
	if (n === 0) return "Today";
	if (n < 0) return "Past";
	return n === 1 ? "1 day" : `${n} days`;
}
function tracked(history, subject) {
	return history.reduce((sum, day) => sum + day[subject], 0);
}
function DeskApp() {
	const user = useCurrentUser();
	const [desk, setDesk] = (0, import_react.useState)(null);
	const [reward, setReward] = (0, import_react.useState)(null);
	const [error, setError] = (0, import_react.useState)(null);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [signedOut, setSignedOut] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		setLoading(true);
		getDesk().then((res) => {
			if (cancelled) return;
			setDesk(res.desk);
			setError(null);
		}).catch((err) => {
			if (cancelled) return;
			const message = messageOf(err);
			if (message.toLowerCase().includes("unauthorized")) {
				setSignedOut(true);
				return;
			}
			setError(message);
		}).finally(() => {
			if (!cancelled) setLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, [user?.id]);
	(0, import_react.useEffect)(() => {
		if (!reward) return;
		const timer = window.setTimeout(() => setReward(null), 1800);
		return () => window.clearTimeout(timer);
	}, [reward]);
	async function run(action) {
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
	if (signedOut) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RedirectToSignIn, {});
	if (loading || !desk) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-10 w-48 animate-pulse rounded-xl bg-raised" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mt-8 h-56 animate-pulse rounded-2xl bg-surface" }),
			error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-sm text-accent",
				children: error
			}) : null
		]
	});
	const todayQuestions = desk.todayQuestions.physics + desk.todayQuestions.chemistry + desk.todayQuestions.maths;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto min-h-screen w-full max-w-5xl px-4 pb-16 pt-4 sm:px-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "sticky top-0 z-10 -mx-4 border-b border-line bg-bg px-4 py-3 sm:-mx-8 sm:px-8",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-start justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted",
							children: "From zero today"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "font-serif text-3xl leading-none text-fg",
							children: "JEE Backlog"
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserButton, {})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex flex-wrap items-center gap-x-5 gap-y-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "flex items-center gap-2 text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Flame, {
									className: desk.streakAliveToday ? "size-4 text-accent" : "size-4 text-muted",
									"aria-hidden": "true"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "tabular-nums font-semibold",
									children: desk.streak === 1 ? "1 day streak" : `${desk.streak} day streak`
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "tabular-nums text-sm font-semibold text-accent",
								children: [desk.xp, " XP"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-sm text-muted tabular-nums",
								children: [
									"Today ",
									todayQuestions,
									" questions · ",
									desk.todayLectures,
									" ",
									desk.todayLectures === 1 ? "lecture" : "lectures"
								]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted",
						children: desk.streakAliveToday ? "Streak is safe today. You finished a lecture." : desk.streak > 0 ? "Finish one lecture today or the streak ends at midnight IST." : "Finish one lecture today to start the streak."
					}),
					reward ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "reward-pop mt-2 text-sm font-semibold text-accent",
						"aria-live": "polite",
						children: [
							reward.xp > 0 ? `+${reward.xp}` : reward.xp,
							" XP · ",
							reward.label
						]
					}) : null,
					error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-accent",
						children: error
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-6 grid gap-3 sm:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExamCard, {
						kicker: "Most important",
						title: "Main January",
						note: "The first listed day is 22 Jan 2027. Change it if your paper is another day.",
						today: desk.today,
						date: desk.settings.janDate,
						disabled: busy,
						onDate: (janDate) => {
							if (janDate) run(() => saveSettings({ data: {
								...desk.settings,
								janDate
							} }));
						}
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExamCard, {
						kicker: "After January",
						title: "Main April",
						note: "The April day is not published yet. Set it when you know it.",
						today: desk.today,
						date: desk.settings.aprilDate,
						disabled: busy,
						onDate: (aprilDate) => {
							run(() => saveSettings({ data: {
								...desk.settings,
								aprilDate
							} }));
						}
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExamCard, {
						kicker: "After April",
						title: "Advanced",
						note: "The Advanced day is not published yet. Set it when you know it.",
						today: desk.today,
						date: desk.settings.advancedDate,
						disabled: busy,
						onDate: (advancedDate) => {
							run(() => saveSettings({ data: {
								...desk.settings,
								advancedDate
							} }));
						}
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plan, {
				desk,
				busy,
				onSave: (settings) => void run(() => saveSettings({ data: settings }))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
				className: "mt-3 grid gap-3 lg:grid-cols-3",
				children: SUBJECTS.map((subject) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SubjectCard, {
					name: subject.name,
					note: subject.note,
					subject: subject.id,
					buckets: desk.buckets.filter((bucket) => bucket.subject === subject.id),
					todayCount: desk.todayQuestions[subject.id],
					trackedCount: tracked(desk.history, subject.id),
					busy,
					onFinish: (bucketId) => void run(() => finishLecture({ data: { bucketId } })),
					onRemaining: (bucketId, remaining) => void run(() => setRemaining({ data: {
						bucketId,
						remaining
					} })),
					onQuestions: (count) => void run(() => setTodayQuestions({ data: {
						subject: subject.id,
						count
					} }))
				}, subject.id))
			}),
			desk.lastLecture ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				className: `${quiet} mt-3 inline-flex items-center gap-2`,
				disabled: busy,
				onClick: () => void run(() => undoLastLecture()),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Undo2, {
						className: "size-4",
						"aria-hidden": "true"
					}),
					"Undo last ",
					desk.lastLecture.label.toLowerCase()
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-6 grid gap-3 lg:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WeakList, {
					desk,
					busy,
					run
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TodoList, {
					desk,
					busy,
					run
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(History, {
				history: desk.history,
				today: desk.today
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-6 text-sm text-muted",
				children: "A lecture is 10 XP, including a one shot. A question is 1 XP. The streak needs one finished lecture that day. Questions are today’s total for each subject, kept for every day you enter, and the day resets at midnight IST. Correcting how many lectures are left does not give XP."
			})
		]
	});
}
function ExamCard({ kicker, title, note, today, date, disabled, onDate }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-2xl border border-line bg-surface p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: kicker
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 font-serif text-4xl leading-none tabular-nums text-fg",
				children: countdownLabel(today, date)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "mt-3 text-base font-semibold text-fg",
				children: title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted",
				children: note
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "mt-4 block text-sm text-muted",
				children: ["Exam day", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					className: field,
					type: "date",
					disabled,
					value: date ?? "",
					onChange: (event) => onDate(event.target.value || null)
				})]
			})
		]
	});
}
function Plan({ desk, busy, onSave }) {
	const late = desk.daysApart !== null && desk.daysApart > 0;
	const early = desk.daysApart !== null && desk.daysApart < 0;
	const parts = SUBJECTS.map((subject) => {
		const left = desk.buckets.filter((bucket) => bucket.subject === subject.id).reduce((sum, bucket) => sum + bucket.remaining, 0);
		return `${subject.name} ${left}`;
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mt-3 rounded-2xl border border-line bg-surface p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "Remaining syllabus"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 font-serif text-6xl leading-none tabular-nums text-fg",
				children: formatHours(desk.hoursLeft)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-muted",
				children: "approximate hours still left"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-4 text-sm text-fg tabular-nums",
				children: [
					desk.lecturesLeft,
					" lectures left · ",
					parts.join(" · ")
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5 border-t border-line pt-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block text-sm text-muted",
						children: ["I plan to finish the remaining syllabus on", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: field,
							type: "date",
							disabled: busy,
							value: desk.settings.targetDate,
							onChange: (event) => {
								if (event.target.value) onSave({
									...desk.settings,
									targetDate: event.target.value
								});
							}
						})]
					}),
					desk.studyDays > 0 && desk.requiredHoursPerDay !== null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-3 text-sm text-fg",
						children: [
							"That is ",
							desk.studyDays,
							" ",
							desk.studyDays === 1 ? "day" : "days",
							" counting today. You need",
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-semibold tabular-nums",
								children: formatHours(desk.requiredHoursPerDay)
							}),
							" hours a day to finish on ",
							formatLong(desk.settings.targetDate),
							"."
						]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-sm text-fg",
						children: desk.hoursLeft <= 0 ? "Nothing left on the lecture count." : "That finish date is already past. Pick a later day."
					}),
					desk.projectedDate && desk.paceHoursPerDay !== null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 text-sm text-fg",
						children: [
							"At the pace you have actually kept (",
							formatHours(desk.paceHoursPerDay),
							" hours a day since you started logging), the remaining syllabus ends",
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-semibold",
								children: formatLong(desk.projectedDate)
							}),
							late && desk.daysApart !== null ? `, ${desk.daysApart} ${desk.daysApart === 1 ? "day" : "days"} after your target.` : early && desk.daysApart !== null ? `, ${Math.abs(desk.daysApart)} ${Math.abs(desk.daysApart) === 1 ? "day" : "days"} before your target.` : "."
						]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted",
						children: "Finish one lecture and this will also show the date your real pace lands on."
					})
				]
			})
		]
	});
}
function SubjectCard({ name, note, subject, buckets, todayCount, trackedCount, busy, onFinish, onRemaining, onQuestions }) {
	const left = buckets.reduce((sum, bucket) => sum + bucket.remaining, 0);
	const done = buckets.reduce((sum, bucket) => sum + bucket.completed, 0);
	const hours = buckets.reduce((sum, bucket) => sum + bucket.remaining * bucket.avgHours, 0);
	const total = left + done;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-2xl border border-line bg-surface p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-base font-semibold text-fg",
				children: name
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 font-serif text-5xl leading-none tabular-nums text-fg",
				children: left
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 text-sm text-muted",
				children: [
					"lectures left · ",
					formatHours(hours),
					" h"
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 h-1 overflow-hidden rounded-full bg-raised",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-full bg-accent",
					style: { width: `${total <= 0 ? 100 : Math.max(0, Math.min(100, done / total * 100))}%` }
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-2 text-sm text-muted tabular-nums",
				children: [done, " finished since today"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted",
				children: note
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 space-y-3",
				children: buckets.map((bucket) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BucketRow, {
					bucket,
					busy,
					onFinish,
					onRemaining
				}, bucket.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(QuestionBox, {
				subject,
				name,
				todayCount,
				trackedCount,
				busy,
				onQuestions
			})
		]
	});
}
function BucketRow({ bucket, busy, onFinish, onRemaining }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [draft, setDraft] = (0, import_react.useState)(String(bucket.remaining));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl bg-bg p-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-baseline justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm font-medium text-fg",
					children: bucket.label
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-sm tabular-nums text-muted",
					children: [bucket.remaining, " left"]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 text-sm text-muted tabular-nums",
				children: [formatHours(bucket.avgHours), " h average"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: `${primary} mt-3 w-full`,
				disabled: busy || bucket.remaining <= 0,
				onClick: () => onFinish(bucket.id),
				children: bucket.remaining <= 0 ? "None left" : "Finished one · 10 XP"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "mt-2 text-sm text-muted underline-offset-4 hover:underline",
				onClick: () => {
					setDraft(String(bucket.remaining));
					setOpen((value) => !value);
				},
				children: "Correct how many are left"
			}),
			open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-2 flex gap-2",
				onSubmit: (event) => {
					event.preventDefault();
					const remaining = Number(draft);
					if (!Number.isInteger(remaining) || remaining < 0 || remaining > 500) return;
					onRemaining(bucket.id, remaining);
					setOpen(false);
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					className: `${field} min-w-0`,
					inputMode: "numeric",
					"aria-label": `${bucket.label} left`,
					value: draft,
					onChange: (event) => setDraft(event.target.value.replace(/[^\d]/g, ""))
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "submit",
					className: quiet,
					disabled: busy,
					children: "Save"
				})]
			}) : null,
			open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted",
				children: "Saving a correction does not give XP."
			}) : null
		]
	});
}
function QuestionBox({ name, todayCount, trackedCount, busy, onQuestions }) {
	const [text, setText] = (0, import_react.useState)(String(todayCount));
	(0, import_react.useEffect)(() => {
		setText(String(todayCount));
	}, [todayCount]);
	function commit(next) {
		if (!Number.isInteger(next) || next < 0 || next > 2e3 || next === todayCount) return;
		onQuestions(next);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-4 border-t border-line pt-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "block text-sm text-muted",
				children: [
					name,
					" questions today",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: field,
						inputMode: "numeric",
						disabled: busy,
						value: text,
						onChange: (event) => setText(event.target.value.replace(/[^\d]/g, "")),
						onBlur: () => commit(Number(text || "0"))
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: quiet,
					disabled: busy,
					onClick: () => commit(todayCount + 1),
					children: "+1"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: quiet,
					disabled: busy,
					onClick: () => commit(todayCount + 10),
					children: "+10"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-2 text-sm text-muted tabular-nums",
				children: [trackedCount, " tracked in all, from today onward"]
			})
		]
	});
}
function WeakList({ desk, busy, run }) {
	const [subject, setSubject] = (0, import_react.useState)("physics");
	const [name, setName] = (0, import_react.useState)("");
	const open = desk.weakTopics.filter((topic) => !topic.cleared);
	const cleared = desk.weakTopics.filter((topic) => topic.cleared);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-2xl border border-line bg-surface p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-base font-semibold text-fg",
				children: "Weak topics"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted",
				children: "Add one yourself. Mark it cleared when it is no longer weak. No XP."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-4 space-y-2",
				onSubmit: (event) => {
					event.preventDefault();
					const topic = name.trim();
					if (!topic) return;
					setName("");
					run(() => addWeakTopic({ data: {
						subject,
						name: topic
					} }));
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block text-sm text-muted",
						children: ["Subject", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
							className: field,
							value: subject,
							onChange: (event) => setSubject(event.target.value),
							children: SUBJECTS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: item.id,
								children: item.name
							}, item.id))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block text-sm text-muted",
						children: ["Topic", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: field,
							value: name,
							maxLength: 120,
							onChange: (event) => setName(event.target.value)
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "submit",
						className: primary,
						disabled: busy || !name.trim(),
						children: "Add weak topic"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
				className: "mt-4 space-y-2",
				children: [open.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "text-sm text-muted",
					children: "None open."
				}) : null, open.map((topic) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "rounded-xl bg-bg p-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm font-medium text-fg",
							children: topic.name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted",
							children: SUBJECTS.find((item) => item.id === topic.subject)?.name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-2 flex gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: quiet,
								disabled: busy,
								onClick: () => void run(() => setWeakCleared({ data: {
									id: topic.id,
									cleared: true
								} })),
								children: "Cleared"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "min-h-11 px-2 text-sm text-muted",
								disabled: busy,
								onClick: () => void run(() => deleteWeakTopic({ data: { id: topic.id } })),
								children: "Remove"
							})]
						})
					]
				}, topic.id))]
			}),
			cleared.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
				className: "mt-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", {
					className: "text-sm text-muted",
					children: [
						"Cleared (",
						cleared.length,
						")"
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-2 space-y-2",
					children: cleared.map((topic) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center justify-between gap-3 text-sm text-muted",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "line-through",
							children: topic.name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "min-h-11 shrink-0",
							disabled: busy,
							onClick: () => void run(() => setWeakCleared({ data: {
								id: topic.id,
								cleared: false
							} })),
							children: "Reopen"
						})]
					}, topic.id))
				})]
			}) : null
		]
	});
}
function TodoList({ desk, busy, run }) {
	const [body, setBody] = (0, import_react.useState)("");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-2xl border border-line bg-surface p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-base font-semibold text-fg",
				children: "To-do"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted",
				children: "Tasks you type. Ticking one does not give XP."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-4 flex gap-2",
				onSubmit: (event) => {
					event.preventDefault();
					const text = body.trim();
					if (!text) return;
					setBody("");
					run(() => addTodo({ data: { body: text } }));
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					className: field,
					value: body,
					maxLength: 200,
					"aria-label": "New task",
					onChange: (event) => setBody(event.target.value)
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "submit",
					className: primary,
					disabled: busy || !body.trim(),
					children: "Add"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
				className: "mt-4 space-y-2",
				children: [desk.todos.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "text-sm text-muted",
					children: "Nothing on the list."
				}) : null, desk.todos.map((todo) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-center gap-3 rounded-xl bg-bg px-3 py-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "checkbox",
							className: "size-5",
							checked: todo.done,
							disabled: busy,
							onChange: () => void run(() => setTodoDone({ data: {
								id: todo.id,
								done: !todo.done
							} })),
							"aria-label": todo.done ? `Reopen ${todo.body}` : `Done ${todo.body}`
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: todo.done ? "flex-1 text-sm text-muted line-through" : "flex-1 text-sm text-fg",
							children: todo.body
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "min-h-11 text-sm text-muted",
							disabled: busy,
							onClick: () => void run(() => deleteTodo({ data: { id: todo.id } })),
							children: "Remove"
						})
					]
				}, todo.id))]
			})
		]
	});
}
function History({ history, today }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mt-3 rounded-2xl border border-line bg-surface p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-base font-semibold text-fg",
				children: "Questions, every day"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted",
				children: "A day appears once you enter a number. Today resets at midnight IST."
			}),
			history.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-sm text-muted",
				children: "Nothing entered yet."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 max-h-80 overflow-auto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full min-w-[28rem] text-left text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
						className: "text-muted",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-2 pr-3 font-medium",
								children: "Day"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-2 pr-3 font-medium",
								children: "Physics"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-2 pr-3 font-medium",
								children: "Chemistry"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-2 pr-3 font-medium",
								children: "Maths"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-2 font-medium",
								children: "Total"
							})
						] })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: history.map((day) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: day.day === today ? "text-fg" : "text-muted",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
								className: "border-t border-line py-2 pr-3 tabular-nums",
								children: [formatLong(day.day), day.day === today ? " · today" : ""]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "border-t border-line py-2 pr-3 tabular-nums",
								children: day.physics
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "border-t border-line py-2 pr-3 tabular-nums",
								children: day.chemistry
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "border-t border-line py-2 pr-3 tabular-nums",
								children: day.maths
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "border-t border-line py-2 tabular-nums",
								children: day.physics + day.chemistry + day.maths
							})
						]
					}, day.day)) })]
				})
			})
		]
	});
}
function Home() {
	const { user, isPending } = useCurrentUserState();
	const [mounted, setMounted] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => setMounted(true), []);
	if (!mounted || isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShellSkeleton, {});
	if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SignInPanel, {});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DeskApp, {});
}
//#endregion
export { Home as component };

import { o as __toESM } from "../_runtime.mjs";
import { J as require_react, x as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as signIn, t as authClient } from "./client-1vAx-gM_.mjs";
import { t as GROK_PROVIDERS } from "./server-DZCv2bc8.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/sign-in-panel-vlX8SqnW.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Current user + loading state. Same behavior in live preview and when deployed:
*   - Auth enabled -> the real signed-in user; `user` is `null` while
*                            the session resolves (`isPending: true`) and when
*                            signed out (`isPending: false`). Session comes from
*                            Better Auth `useSession()` → `/api/auth/get-session`
*                            (cookie when deployed; bearer in live preview).
*   - Auth disabled (`VITE_AUTH_ENABLED=false`) -> `DEV_USER`, never pending.
*
* Protect a route by waiting out `isPending` before acting on `user` —
* redirecting on `user: null` alone bounces signed-in visitors to sign-in on
* every hard reload:
*
*   import { RedirectToSignIn } from "@/lib/auth/gates";
*   const { user, isPending } = useCurrentUserState();
*   if (isPending) return null;              // still resolving — don't redirect yet
*   if (!user) return <RedirectToSignIn />;  // definitely signed out
*
* `authEnabled` is a module-level constant fixed at load, so the guarded hook
* call keeps a stable hook order across every render of a given component.
*/
function useCurrentUserState() {
	return useSessionUserState();
}
function useSessionUserState() {
	const { data, isPending } = authClient.useSession();
	const id = data?.user.id;
	const displayName = data?.user.name ?? null;
	const primaryEmail = data?.user.email ?? null;
	const profileImageUrl = data?.user.image ?? null;
	const user = (0, import_react.useMemo)(() => id ? {
		id,
		displayName,
		primaryEmail,
		profileImageUrl,
		isDevFallback: false
	} : null, [
		id,
		displayName,
		primaryEmail,
		profileImageUrl
	]);
	return (0, import_react.useMemo)(() => ({
		user,
		isPending
	}), [user, isPending]);
}
/**
* Convenience view of `useCurrentUserState().user` for display (e.g.
* `user?.displayName ?? "Guest"`). NOTE: `null` means *loading OR signed out* —
* for redirects/guards use `useCurrentUserState()` and check `isPending`.
*/
function useCurrentUser() {
	return useCurrentUserState().user;
}
var field = "mt-1 w-full min-h-11 rounded-xl border border-line bg-bg px-3 text-base text-fg outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
function ShellSkeleton() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "From zero today"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-2 font-serif text-5xl leading-none text-fg",
				children: "JEE Backlog"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-muted",
				children: "Loading your desk"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-8 grid gap-3 sm:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-36 animate-pulse rounded-2xl bg-surface" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-36 animate-pulse rounded-2xl bg-surface" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-36 animate-pulse rounded-2xl bg-surface" })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mt-3 h-56 animate-pulse rounded-2xl bg-surface" })
		]
	});
}
function SignInPanel() {
	const [mode, setMode] = (0, import_react.useState)("up");
	const [name, setName] = (0, import_react.useState)("");
	const [email, setEmail] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)(null);
	const [pending, setPending] = (0, import_react.useState)(false);
	async function onEmail(event) {
		event.preventDefault();
		setError(null);
		setPending(true);
		try {
			if (mode === "up") {
				const { error: signUpError } = await authClient.signUp.email({
					email: email.trim(),
					password,
					name: name.trim() || email.trim().split("@")[0] || "Student",
					callbackURL: "/"
				});
				if (signUpError) throw new Error(signUpError.message || "Could not create the account.");
			} else {
				const { error: signInError } = await authClient.signIn.email({
					email: email.trim(),
					password,
					callbackURL: "/"
				});
				if (signInError) throw new Error(signInError.message || "Could not sign in.");
			}
			window.location.href = "/";
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not sign in.");
			setPending(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "From zero today"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-2 font-serif text-5xl leading-none text-fg",
				children: "JEE Backlog"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-muted",
				children: "Sign in so lectures left, daily questions, weak topics, and tasks stay on your account."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-8 flex flex-col gap-2",
					children: GROK_PROVIDERS.map((provider) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => {
							signIn(provider.providerId, { callbackURL: "/" }).catch((err) => {
								setError(err instanceof Error ? err.message : "Could not sign in.");
							});
						},
						className: "min-h-11 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-fg",
						children: ["Continue with ", provider.label]
					}, provider.providerId))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-6 text-sm text-muted",
					children: "Or use email"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					onSubmit: onEmail,
					className: "mt-3 space-y-3",
					children: [
						mode === "up" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "block text-sm text-muted",
							children: ["Name", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: field,
								value: name,
								onChange: (event) => setName(event.target.value),
								autoComplete: "name",
								maxLength: 80
							})]
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "block text-sm text-muted",
							children: ["Email", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: field,
								type: "email",
								required: true,
								value: email,
								onChange: (event) => setEmail(event.target.value),
								autoComplete: "email"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "block text-sm text-muted",
							children: ["Password", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: field,
								type: "password",
								required: true,
								minLength: 8,
								value: password,
								onChange: (event) => setPassword(event.target.value),
								autoComplete: mode === "up" ? "new-password" : "current-password"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted",
							children: "At least 8 characters."
						}),
						error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-accent",
							children: error
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "submit",
							disabled: pending,
							className: "min-h-11 w-full rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-40",
							children: pending ? "Please wait…" : mode === "up" ? "Create account" : "Sign in"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "mt-4 text-left text-sm text-muted underline-offset-4 hover:underline",
					onClick: () => {
						setMode(mode === "up" ? "in" : "up");
						setError(null);
					},
					children: mode === "up" ? "I already have an account" : "Create an account"
				})
			] })
		]
	});
}
//#endregion
export { useCurrentUserState as i, SignInPanel as n, useCurrentUser as r, ShellSkeleton as t };

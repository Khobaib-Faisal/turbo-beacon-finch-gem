import { useState, type FormEvent } from "react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";

const field =
  "mt-1 w-full min-h-11 rounded-xl border border-line bg-bg px-3 text-base text-fg outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function ShellSkeleton() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-8">
      <p className="text-sm text-muted">From zero today</p>
      <h1 className="mt-2 font-serif text-5xl leading-none text-fg">JEE Backlog</h1>
      <p className="mt-3 text-sm text-muted">Loading your desk</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <div className="h-36 animate-pulse rounded-2xl bg-surface" />
        <div className="h-36 animate-pulse rounded-2xl bg-surface" />
        <div className="h-36 animate-pulse rounded-2xl bg-surface" />
      </div>
      <div className="mt-3 h-56 animate-pulse rounded-2xl bg-surface" />
    </main>
  );
}

export function SignInPanel() {
  const [mode, setMode] = useState<"up" | "in">("up");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onEmail(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === "up") {
        const { error: signUpError } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim() || email.trim().split("@")[0] || "Student",
          callbackURL: "/",
        });
        if (signUpError) throw new Error(signUpError.message || "Could not create the account.");
      } else {
        const { error: signInError } = await authClient.signIn.email({
          email: email.trim(),
          password,
          callbackURL: "/",
        });
        if (signInError) throw new Error(signInError.message || "Could not sign in.");
      }
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <p className="text-sm text-muted">From zero today</p>
      <h1 className="mt-2 font-serif text-5xl leading-none text-fg">JEE Backlog</h1>
      <p className="mt-4 text-muted">
        Sign in so lectures left, daily questions, weak topics, and tasks stay on your account.
      </p>

      {authEnabled ? (
        <>
          <div className="mt-8 flex flex-col gap-2">
            {GROK_PROVIDERS.map((provider) => (
              <button
                key={provider.providerId}
                type="button"
                onClick={() => {
                  void signIn(provider.providerId, { callbackURL: "/" }).catch((err) => {
                    setError(err instanceof Error ? err.message : "Could not sign in.");
                  });
                }}
                className="min-h-11 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-fg"
              >
                Continue with {provider.label}
              </button>
            ))}
          </div>

          <p className="mt-6 text-sm text-muted">Or use email</p>
          <form onSubmit={onEmail} className="mt-3 space-y-3">
            {mode === "up" ? (
              <label className="block text-sm text-muted">
                Name
                <input
                  className={field}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  maxLength={80}
                />
              </label>
            ) : null}
            <label className="block text-sm text-muted">
              Email
              <input
                className={field}
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </label>
            <label className="block text-sm text-muted">
              Password
              <input
                className={field}
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "up" ? "new-password" : "current-password"}
              />
            </label>
            <p className="text-sm text-muted">At least 8 characters.</p>
            {error ? <p className="text-sm text-accent">{error}</p> : null}
            <button type="submit" disabled={pending} className="min-h-11 w-full rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-40">
              {pending ? "Please wait…" : mode === "up" ? "Create account" : "Sign in"}
            </button>
          </form>
          <button
            type="button"
            className="mt-4 text-left text-sm text-muted underline-offset-4 hover:underline"
            onClick={() => {
              setMode(mode === "up" ? "in" : "up");
              setError(null);
            }}
          >
            {mode === "up" ? "I already have an account" : "Create an account"}
          </button>
        </>
      ) : (
        <p className="mt-6 text-sm text-muted">Sign-in is turned off.</p>
      )}
    </main>
  );
}

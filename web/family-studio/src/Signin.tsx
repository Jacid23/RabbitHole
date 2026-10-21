import { useState } from "react";
import { api } from "./api";
import { LoginDescent } from "./LoginDescent";

export function Signin({
  checking = false,
  onSuccess,
}: {
  checking?: boolean;
  onSuccess: (notBefore: number) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState("");
  return (
    <main className="public-signin">
      <div className="public-signin-brand">Rabbit Hole</div>
      <section
        className="public-signin-card"
        aria-labelledby="signin-title"
        inert={busy || undefined}
      >
        <h1 id="signin-title">Sign in</h1>
        <p>Use your account to continue.</p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy || checking) return;
            const notBefore =
              Date.now() +
              (window.matchMedia("(prefers-reduced-motion: reduce)").matches
                ? 0
                : 1800);
            setBusy(true);
            setError("");
            try {
              if (!authenticated) {
                await api("/api/auth/signin", {
                  email: email.trim(),
                  password,
                });
                setAuthenticated(true);
                setPassword("");
              }
              await onSuccess(notBefore);
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {!authenticated && (
            <>
              <label>
                Email address
                <input
                  type="email"
                  autoComplete="username"
                  required
                  autoFocus
                  disabled={checking}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  disabled={checking}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
            </>
          )}
          {error && (
            <p role="alert" className="public-signin-error">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy || checking}>
            {checking
              ? "Checking session…"
              : authenticated
                ? "Retry opening your space"
                : "Sign in"}
          </button>
        </form>
      </section>
      {busy && <LoginDescent />}
    </main>
  );
}

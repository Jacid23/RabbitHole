import { useState } from "react";
import { api } from "./api";
import { Icon, StudioMark } from "./Icons";
import { useDialog } from "./useDialog";
export function Signin({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const dialog = useDialog(true, onClose);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [authenticated, setAuthenticated] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="modal-backdrop">
      <section
        ref={dialog}
        className="signin dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="signin-title"
      >
        <button
          className="icon-button dialog-close"
          aria-label="Close sign in"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
        <StudioMark />
        <p className="eyebrow">YOU FOUND THE DOOR</p>
        <h1 id="signin-title">
          Curiouser
          <br />& curiouser.
        </h1>
        <p>
          Use your existing Open WebUI account.
          <br />
          Your models and access come with you.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
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
              await onSuccess();
            } catch (e) {
              setError(String((e as Error).message));
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            </>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy
              ? authenticated
                ? "Going down the rabbit hole…"
                : "Signing in…"
              : authenticated
                ? "Retry opening Rabbit Hole"
                : "Enter Rabbit Hole"}
            <Icon name="arrow" size={17} />
          </button>
        </form>
        <div className="signin-foot">
          <Icon name="lock" size={13} />
          Account access is checked by your Open WebUI server.
        </div>
      </section>
    </div>
  );
}

import { useState } from "react";
import { useAuth } from "../store/AuthContext";
import { Button, Card, Field, inputClass } from "../components/ui";

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signedUp, setSignedUp] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const message =
      mode === "signin"
        ? await signIn(email, password)
        : await signUp(email, password, displayName.trim() || email.split("@")[0]);
    setBusy(false);
    if (message) {
      setError(message);
    } else if (mode === "signup") {
      setSignedUp(true);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">CGGolf</h1>
          <p className="text-sm text-slate-500 mt-1">
            Sign in to track rounds and handicaps with your friends
          </p>
        </div>

        <Card>
          {signedUp ? (
            <div className="text-center py-4">
              <p className="font-semibold text-slate-800 mb-1">Check your email</p>
              <p className="text-sm text-slate-500">
                We sent a confirmation link to {email}. Confirm it, then sign in below.
              </p>
              <Button
                className="w-full mt-4"
                onClick={() => {
                  setSignedUp(false);
                  setMode("signin");
                }}
              >
                Back to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === "signup" && (
                <Field label="Your name">
                  <input
                    className={inputClass}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="David"
                    autoComplete="name"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    If a friend already added you by name before you signed up, use the exact
                    same name here so your rounds link up automatically.
                  </p>
                </Field>
              )}
              <Field label="Email">
                <input
                  type="email"
                  required
                  className={inputClass}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </Field>
              <Field label="Password">
                <input
                  type="password"
                  required
                  minLength={6}
                  className={inputClass}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                />
              </Field>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
              </Button>
            </form>
          )}
        </Card>

        {!signedUp && (
          <p className="text-center text-sm text-slate-500 mt-4">
            {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="text-green-700 font-medium"
              onClick={() => {
                setError(null);
                setMode(mode === "signin" ? "signup" : "signin");
              }}
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

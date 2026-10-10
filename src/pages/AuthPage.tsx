import { useState } from "react";
import { useAuth } from "../store/AuthContext";
import { Button, Card, Field, inputClass } from "../components/ui";

export function AuthPage() {
  const { signIn, signInWithPhone } = useAuth();
  const [useEmail, setUseEmail] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const message = useEmail
      ? await signIn(email, password)
      : await signInWithPhone(name.trim(), phone);
    setBusy(false);
    if (message) setError(message);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">CGGolf</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track rounds and handicaps with your friends
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-3">
            {useEmail ? (
              <>
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
                    className={inputClass}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </Field>
              </>
            ) : (
              <>
                <Field label="Your name">
                  <input
                    required
                    className={inputClass}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="David Whitaker"
                    autoComplete="name"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    If a friend already added you by name, use the exact same name so your rounds
                    link up automatically.
                  </p>
                </Field>
                <Field label="Phone number">
                  <input
                    type="tel"
                    required
                    className={inputClass}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="573-555-1234"
                    autoComplete="tel"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    First time? This creates your account. Next time, just enter the same number.
                  </p>
                </Field>
              </>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Please wait…" : "Continue"}
            </Button>
          </form>
        </Card>

        <p className="text-center text-sm text-slate-500 mt-4">
          <button
            type="button"
            className="text-green-700 font-medium"
            onClick={() => {
              setError(null);
              setUseEmail(!useEmail);
            }}
          >
            {useEmail ? "Use name & phone instead" : "Sign in with email instead"}
          </button>
        </p>
      </div>
    </div>
  );
}

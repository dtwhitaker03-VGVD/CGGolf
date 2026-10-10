import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

interface AuthState {
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signInWithPhone: (name: string, phone: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signUp(email: string, password: string, displayName: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    return error?.message ?? null;
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }

  // Name + phone only, no verification: the phone number maps to a hidden
  // email/password pair. Signs in if the number is known, otherwise creates it.
  async function signInWithPhone(name: string, phone: string) {
    const digits = phone.replace(/\D/g, "").replace(/^1(\d{10})$/, "$1");
    if (digits.length < 10) return "Enter a valid 10-digit phone number.";
    const email = `${digits}@phone.cggolf.app`;
    const password = `cggolf-${digits}-phone`;
    const first = await supabase.auth.signInWithPassword({ email, password });
    if (!first.error) return null;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    });
    if (error) return error.message;
    if (!data.session) {
      return "Sign-up needs 'Confirm email' turned off in Supabase (Authentication → Providers → Email).";
    }
    return null;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthCtx.Provider value={{ session, loading, signUp, signIn, signInWithPhone, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

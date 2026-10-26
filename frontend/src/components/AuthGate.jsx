"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { flushPendingSupabaseSaves, clearPendingSupabaseSaves } from "@/lib/maps-storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/input";
import { ArchersBowIcon } from "@/components/ui/ArchersBowIcon";

const AuthContext = createContext({
  session: null,
  user: null,
  signOut: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * Converts raw Supabase / HTTP error messages into friendly,
 * user-facing sentences instead of technical jargon.
 */
function friendlyError(err) {
  if (!err) return "";
  const msg = (err.message || "").toLowerCase();
  const status = err.status ?? err.code ?? 0;

  // Wrong password / bad credentials (Supabase returns 400 for this)
  if (
    status === 400 ||
    msg.includes("invalid login credentials") ||
    msg.includes("invalid password") ||
    msg.includes("wrong password")
  ) {
    return "Incorrect password — please try again.";
  }

  // Email not found / user doesn't exist
  if (
    status === 404 ||
    msg.includes("user not found") ||
    msg.includes("email not found") ||
    msg.includes("no user found")
  ) {
    return "No account found with that email address.";
  }

  // Email already registered (sign-up duplicate)
  if (
    msg.includes("user already registered") ||
    msg.includes("already been registered") ||
    msg.includes("email already in use") ||
    msg.includes("duplicate")
  ) {
    return "That email is already registered — try signing in instead.";
  }

  // Too many requests / rate-limited
  if (status === 429 || msg.includes("rate limit") || msg.includes("too many requests")) {
    return "Too many attempts. Please wait a moment and try again.";
  }

  // Network / server unreachable
  if (
    status === 500 ||
    status === 503 ||
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("failed to fetch")
  ) {
    return "Cannot reach the server — check your internet connection.";
  }

  // Session expired / unauthorised
  if (status === 401 || msg.includes("unauthorized") || msg.includes("jwt")) {
    return "Your session has expired. Please sign in again.";
  }

  // Weak / short password
  if (msg.includes("password") && (msg.includes("short") || msg.includes("weak") || msg.includes("6"))) {
    return "Password must be at least 6 characters.";
  }

  // Email confirmation still pending
  if (msg.includes("email not confirmed") || msg.includes("confirm")) {
    return "Please confirm your email before signing in.";
  }

  // Fallback — capitalise the original message so it at least reads cleanly
  return err.message.charAt(0).toUpperCase() + err.message.slice(1);
}

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!supabaseConfigured) {
    return (
      <main className="mx-auto max-w-md p-8">
        <h1 className="text-xl font-semibold">Supabase isn't configured</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Copy <code className="font-mono">.env.example</code> to <code className="font-mono">.env.local</code> and set
          NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart the dev server.
        </p>
      </main>
    );
  }

  if (session === undefined) return null;

  if (!session) {
    const submit = async (e) => {
      e.preventDefault();
      setBusy(true);
      setError("");
      setInfo("");
      const fn = mode === "signin" ? supabase.auth.signInWithPassword : supabase.auth.signUp;
      const { data, error: err } = await fn.call(supabase.auth, { email, password });
      setBusy(false);
      if (err) setError(friendlyError(err));
      else if (mode === "signup" && !data.session)
        setInfo("Check your email to confirm your account, then sign in.");
    };

    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 mb-3 shadow-lg shadow-indigo-600/10">
            <ArchersBowIcon className="size-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Bow and Arrow</h1>
          <p className="mt-1 text-xs text-muted-foreground">Sign in to build and target your study roadmaps.</p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="text-sm" htmlFor="email">Email</label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="text-sm" htmlFor="password">Password</label>
          <PasswordInput
            id="password"
            required
            minLength={6}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {info && (
            <p role="status" className="text-sm text-done">
              {info}
            </p>
          )}

          <Button type="submit" disabled={busy}>
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError("");
              setInfo("");
            }}
          >
            {mode === "signin" ? "I need an account" : "I already have an account"}
          </Button>
        </form>
      </main>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session.user,
        signOut: async () => {
          try {
            await flushPendingSupabaseSaves();
          } catch {}
          clearPendingSupabaseSaves();
          if (supabase) await supabase.auth.signOut();
        },
      }}
    >
      <div key={session?.user?.id || "auth_user"} className="contents">
        {children}
      </div>
    </AuthContext.Provider>
  );
}

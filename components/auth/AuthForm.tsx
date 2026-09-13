"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Loader2, LogIn, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

type AuthFormProps = {
  returnTo: string;
  initialMessage?: string;
  initialMode?: Mode;
};

export function AuthForm({ returnTo, initialMessage = "", initialMode = "signin" }: AuthFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(initialMessage);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const callback = `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}`;
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: callback } });

    setLoading(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (mode === "signup" && !result.data.session) {
      setMessage("Check your email to confirm your account, then sign in.");
      return;
    }

    router.push(returnTo);
    router.refresh();
  }

  async function handleGoogle() {
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}` }
    });
    if (error) {
      setLoading(false);
      setMessage(error.message);
    }
  }

  return (
    <div className="grid auth-form">
      <div className="tabs" role="tablist" aria-label="Authentication mode">
        <button className={`tab ${mode === "signin" ? "active" : ""}`} type="button" onClick={() => setMode("signin")} disabled={loading}>Sign in</button>
        <button className={`tab ${mode === "signup" ? "active" : ""}`} type="button" onClick={() => setMode("signup")} disabled={loading}>Create account</button>
      </div>
      <button className="button" type="button" onClick={handleGoogle} disabled={loading}>
        <Calendar size={17} /> Continue with Google
      </button>
      <form className="grid" onSubmit={handleEmail}>
        <input className="input" type="email" autoComplete="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading} required />
        <input className="input" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} placeholder="Password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} required />
        <button className="button primary" type="submit" disabled={loading}>
          {loading ? <Loader2 size={17} /> : mode === "signin" ? <LogIn size={17} /> : <UserPlus size={17} />}
          {mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>
      {message ? <p className="muted" role="status">{message}</p> : null}
    </div>
  );
}

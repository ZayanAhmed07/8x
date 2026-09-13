"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

type AuthFormProps = {
  returnTo: string;
  initialMessage?: string;
  initialMode?: Mode;
};

export function AuthForm({ returnTo, initialMessage = "", initialMode = "signin" }: AuthFormProps) {
  const router = useRouter();
  const mode = initialMode;
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(initialMessage);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
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
    } catch { setMessage("Unable to sign in. Check your connection and try again."); }
    finally { setLoading(false); }
  }

  async function handleGoogle() {
    setLoading(true);
    setMessage("");
    try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}` }
    });
    if (error) {
      setLoading(false);
      setMessage(error.message);
    }
    } catch { setLoading(false); setMessage("Unable to reach Google sign-in. Please try again."); }
  }

  return (
    <div className="grid auth-form">
      <button className="button" type="button" onClick={handleGoogle} disabled={loading}>
        <span className="google-mark" aria-hidden="true">G</span> Continue with Google
      </button>
      <div className="auth-divider">or continue with email</div>
      <form className="grid" onSubmit={handleEmail}>
        <label>Email address<input className="input" type="email" autoComplete="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading} required /></label>
        <label>Password<div className="password-field"><input className="input" type={showPassword ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} placeholder="Password" minLength={mode === "signup" ? 6 : undefined} value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} required /></div><button className="password-toggle" type="button" onClick={() => setShowPassword(!showPassword)} aria-pressed={showPassword}>{showPassword ? "Hide password" : "Show password"}</button></label>
        <button className="button primary" type="submit" disabled={loading}>
          {loading ? <Loader2 size={17} /> : mode === "signin" ? <LogIn size={17} /> : <UserPlus size={17} />}
          {mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>
      <p className="auth-switch">{mode === "signin" ? "New here? " : "Already have an account? "}<Link href={`${mode === "signin" ? "/sign-up" : "/sign-in"}?next=${encodeURIComponent(returnTo)}`}>{mode === "signin" ? "Create an account" : "Sign in"}</Link></p>
      {message ? <p className="muted" role="status">{message}</p> : null}
    </div>
  );
}

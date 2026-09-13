import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { getCurrentUser } from "@/lib/auth";
import { safeReturnPath } from "@/lib/auth/return-path";

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const [{ next, error }, user] = await Promise.all([searchParams, getCurrentUser()]);
  const returnTo = safeReturnPath(next);
  if (user) redirect(returnTo);
  return <div className="auth-shell"><section className="auth-panel"><h1>Sign up</h1><p className="muted">Create an account with Google OAuth or email and password.</p><AuthForm returnTo={returnTo} initialMessage={error} initialMode="signup" /></section></div>;
}

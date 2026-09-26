import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthStory } from "@/components/auth/AuthStory";
import { getCurrentUser } from "@/lib/auth";
import { safeReturnPath } from "@/lib/auth/return-path";

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const [{ next, error }, user] = await Promise.all([searchParams, getCurrentUser()]);
  const returnTo = safeReturnPath(next);
  if (user) redirect(returnTo);
  return <div className="auth-shell"><AuthStory/><section className="auth-panel"><h1>Start your workspace</h1><p className="muted">Free while in preview. Your first recording replaces the sample team.</p><AuthForm returnTo={returnTo} initialMessage={error} initialMode="signup" /></section></div>;
}

import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { getCurrentUser } from "@/lib/auth";
import { safeReturnPath } from "@/lib/auth/return-path";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const [{ next, error }, user] = await Promise.all([searchParams, getCurrentUser()]);
  const returnTo = safeReturnPath(next);
  if (user) redirect(returnTo);
  return <div className="auth-shell"><aside className="auth-story"><span className="pill">A clearer day starts here</span><h2>Less writing.<br/>More listening.<br/><em>Nothing lost.</em></h2><p>Keep the context, capture the decisions, and leave every meeting with a next step.</p><div className="auth-story-note">&ldquo;Let&apos;s make the next step clear.&rdquo;<span>From the conversation to your action list.</span></div></aside><section className="auth-panel"><span className="eyebrow">YOUR MEETING WORKSPACE</span><h1>Welcome back.</h1><p className="muted">Your meetings, insights, and next steps are right where you left them.</p><AuthForm returnTo={returnTo} initialMessage={error} initialMode="signin" /></section></div>;
}

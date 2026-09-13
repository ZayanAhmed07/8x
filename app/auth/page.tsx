import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { getCurrentUser } from "@/lib/auth";
import { safeReturnPath } from "@/lib/auth/return-path";

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const [{ next, error }, user] = await Promise.all([searchParams, getCurrentUser()]);
  const returnTo = safeReturnPath(next);
  if (user) redirect(returnTo);

  return (
    <div className="auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">Welcome</p>
        <h1>Sign in to Fathom Workspace</h1>
        <p className="muted">Use email or Google to keep meetings, recordings, and integrations tied to your account.</p>
        <AuthForm returnTo={returnTo} initialMessage={error} />
      </section>
    </div>
  );
}
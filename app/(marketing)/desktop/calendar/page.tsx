import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { CalendarCheck, CalendarDays } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

export const metadata = { title: "Connect Google Calendar" };

const MESSAGES: Record<string, string> = {
  denied: "Calendar access was cancelled. Nothing was connected.",
  invalid_state: "That request expired. Try connecting again.",
  sync_error: "Connected, but the first sync failed. Tally Capture will retry on its own.",
  error: "Google didn't complete the connection. Try again."
};

/** Opened from Tally Capture's "Connect Google Calendar" button. */
export default async function DesktopCalendarPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const [{ google }, user] = await Promise.all([searchParams, getCurrentUser()]);
  if (!user) redirect(`/sign-in?next=${encodeURIComponent("/desktop/calendar")}`);
  const [connection] = await getDb().select({ email: schema.googleConnections.email }).from(schema.googleConnections).where(eq(schema.googleConnections.userId, user.id));

  return <div className="page narrow" style={{ maxWidth: 520, paddingTop: 72 }}>
    <section className="card" style={{ padding: 28 }}>
      {connection ? <>
        <CalendarCheck size={28} color="var(--ok)"/>
        <h1 style={{ fontSize: "2rem", margin: "14px 0 10px" }}>Calendar connected</h1>
        <p className="muted">Tally Capture now sees your Google Meet calls from <strong>{connection.email}</strong> and will remind you before each one. You can close this tab and go back to the app.</p>
      </> : <>
        <CalendarDays size={28} color="var(--accent)"/>
        <h1 style={{ fontSize: "2rem", margin: "14px 0 10px" }}>Connect Google Calendar</h1>
        <p className="muted">Tally Capture lists your upcoming Google Meet calls, reminds you before they start, and names recordings after the event. Access is read-only.</p>
        {google && MESSAGES[google] && <p className="form-message" role="status" style={{ marginTop: 14 }}>{MESSAGES[google]}</p>}
        <a className="button primary" href="/api/integrations/google/connect?return=/desktop/calendar" style={{ marginTop: 18, minHeight: 44, width: "100%" }}>Continue with Google</a>
        <p className="faint" style={{ marginTop: 12, fontSize: 13 }}>Signed in to Tally as {user.email}. <Link className="text-link" href="/settings#calendar">Manage in Settings</Link></p>
      </>}
    </section>
  </div>;
}

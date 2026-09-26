import Link from "next/link";
import { eq } from "drizzle-orm";
import { Download, Monitor } from "lucide-react";
import { CalendarControls } from "@/components/calendar/CalendarControls";
import { listDevices } from "@/lib/desktop-auth";
import { revokeDeviceAction } from "./actions";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

export const metadata = { title: "Settings" };

const DOWNLOAD_URL = process.env.NEXT_PUBLIC_CAPTURE_DOWNLOAD_URL ?? "https://github.com/ZayanAhmed07/8x/releases/latest/download/Tally-Capture-Setup.exe";

const NOTICES: Record<string, string> = {
  connected: "Google Calendar connected and synced. Your upcoming meetings are on the Meetings page.",
  sync_error: "Calendar connected, but the first sync failed. Try Sync calendar below.",
  denied: "Calendar access was cancelled. You can connect again when ready.",
  invalid_state: "The connection request expired. Please try connecting again.",
  error: "Calendar connection failed. Please reconnect and try again."
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const [{ google }, user] = await Promise.all([searchParams, requireUser()]);
  const [devices, [connection]] = await Promise.all([listDevices(user.id), getDb().select({ email: schema.googleConnections.email, lastSyncedAt: schema.googleConnections.lastSyncedAt, error: schema.googleConnections.error }).from(schema.googleConnections).where(eq(schema.googleConnections.userId, user.id))]);

  return <div className="page narrow">
    <div className="page-head"><div><h1>Settings</h1><p>Signed in as {user.email}.</p></div></div>
    {google && NOTICES[google] && <p className="form-message" role="status" style={{ marginBottom: 16 }}>{NOTICES[google]}</p>}
    <div className="stack">
      <section id="calendar" className="card">
        <h2>Google Calendar</h2>
        <p className="muted">{connection ? `Connected as ${connection.email}.` : "Read-only access, used to list your upcoming Google Meet calls so you can record them."}</p>
        {connection?.lastSyncedAt && <p className="faint">Last synced {connection.lastSyncedAt.toLocaleString("en-GB")}</p>}
        {connection?.error && <p className="connection-error">{connection.error}</p>}
        <div style={{ marginTop: 14 }}><CalendarControls connected={Boolean(connection)}/></div>
      </section>
      <section id="recording" className="card recording-setup">
        <h2>Tally Capture for Windows</h2>
        <p className="muted">Records your microphone and your computer's audio as separate tracks, only after you press Record. There's no bot in your calls, and the transcript knows which lines are yours.</p>
        <div className="toolbar"><a className="button primary" href={DOWNLOAD_URL}><Download size={15}/>Download Tally Capture</a><Link className="button" href="/upload">Upload a file instead</Link></div>
        <p className="faint" style={{ fontSize: 13 }}>Open it and choose Sign in with your browser. You'll approve it here, with the account you're using now.</p>
        <p className="muted" style={{ fontSize: 14 }}><strong>Using Google Meet?</strong> Add the Tally for Meet Chrome extension and your transcripts get real names instead of “Others on the call”. It reads Meet's captions and passes names to Tally Capture on your computer.</p>
      </section>
      <section id="devices" className="card">
        <h2>Signed-in devices</h2>
        {devices.length === 0 ? <p className="muted">No devices yet.</p> : <ul>{devices.map((device) => <li key={device.id} className="toolbar" style={{ justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid var(--line)" }}>
          <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}><Monitor size={16}/><span><strong style={{ fontWeight: 600 }}>{device.deviceName ?? "Desktop"}</strong><br/><span className="faint" style={{ fontSize: 13 }}>Signed in {device.createdAt.toLocaleDateString("en-GB")}{device.lastUsedAt ? ` · last used ${device.lastUsedAt.toLocaleString("en-GB")}` : ""}</span></span></span>
          <form action={revokeDeviceAction}><input type="hidden" name="id" value={device.id}/><button className="button small" type="submit">Sign out</button></form>
        </li>)}</ul>}
      </section>
    </div>
  </div>;
}

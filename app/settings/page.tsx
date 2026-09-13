import { eq } from "drizzle-orm";
import { Calendar, CheckCircle2, ShieldCheck } from "lucide-react";
import { CalendarControls } from "@/components/calendar/CalendarControls";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

const integrations = ["Google Meet", "Zoom", "Teams", "Slack", "HubSpot"];

export default async function SettingsPage() {
  const user = await requireUser();
  const [connection] = await getDb().select({ email: schema.googleConnections.email, lastSyncedAt: schema.googleConnections.lastSyncedAt, error: schema.googleConnections.error }).from(schema.googleConnections).where(eq(schema.googleConnections.userId, user.id));
  return <><div className="page-head"><div><p className="eyebrow">Settings</p><h1>Integrations</h1><p className="muted">Connect Calendar for event discovery, then hand off recording to the desktop agent.</p></div></div><section className="card" style={{marginBottom:18}}><div className="toolbar"><ShieldCheck color="#586a4d"/><h2>Account</h2></div><p className="muted">Signed in as {user.email}</p><span className="badge ready">Authenticated</span></section><section className="card" style={{marginBottom:18}}><div className="toolbar"><Calendar color="#b85042"/><h2>Google Calendar</h2></div><p className="muted">{connection ? `Connected as ${connection.email}` : "Read-only Calendar access finds Google Meet events. Recording still requires you to press Record in the desktop app."}</p>{connection?.lastSyncedAt ? <p className="muted">Last sync {connection.lastSyncedAt.toLocaleString()}</p> : null}{connection?.error ? <p className="muted">{connection.error}</p> : null}<CalendarControls connected={Boolean(connection)} /></section><div className="grid cards">{integrations.map((name) => <section className="card" key={name}><div className="toolbar"><CheckCircle2 color="#586a4d"/><h2>{name}</h2></div><span className="badge">Not connected</span></section>)}</div></>;
}
import Link from "next/link";
import { eq } from "drizzle-orm";
import { listMeetings } from "@/lib/db/queries";
import { getDb } from "@/lib/db/client";
import { googleConnections } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { listUpcomingCalendarEvents } from "@/lib/calendar";
import { UpcomingMeetEvents } from "@/components/calendar/UpcomingMeetEvents";
import { ConnectCalendarButton } from "@/components/calendar/ConnectCalendarButton";
import { MeetingLibrary } from "@/components/meeting/MeetingLibrary";
import { CalendarDays, CheckCircle2, Upload, ArrowRight, Video, Sparkles } from "lucide-react";

export default async function MeetingsPage() {
  const user = await requireUser();
  const [meetings, events, connections] = await Promise.all([listMeetings(user.id), listUpcomingCalendarEvents(user.id), getDb().select({ lastSyncedAt: googleConnections.lastSyncedAt }).from(googleConnections).where(eq(googleConnections.userId, user.id))]);
  const connected = connections.length > 0;
  return <>
    <div className="page-head"><div><p className="eyebrow">YOUR WORKSPACE</p><h1>My meetings</h1><p className="muted">Your upcoming calls, recordings, and follow-ups in one place.</p></div><Link className="button" href="/upload"><Upload size={17}/>Upload recording</Link></div>
    <section className="setup-panel" aria-labelledby="setup-title"><div className="setup-heading"><div><span className="eyebrow">GET STARTED</span><h2 id="setup-title">{connected ? "You're connected. Capture your next conversation." : "Your first meeting starts here."}</h2><p className="muted">Follow these steps to turn a conversation into a recap.</p></div><span className={`badge ${connected ? "ready" : ""}`}>{connected ? "Calendar connected" : "Calendar not connected"}</span></div><div className="setup-steps">
      <article className={connected ? "setup-step complete" : "setup-step current"}><span className="step-icon">{connected ? <CheckCircle2/> : <CalendarDays/>}</span><span className="feature-label">STEP 1</span><h3>Connect your calendar</h3><p>See Google Meet calls from your primary calendar. Calendar access is read-only.</p>{connected ? <Link href="/settings#calendar">Manage connection <ArrowRight size={14}/></Link> : <ConnectCalendarButton />}</article>
      <article className="setup-step"><span className="step-icon"><Video/></span><span className="feature-label">STEP 2</span><h3>Record a conversation</h3><p>Join your call, open Fathom Capture, choose the meeting window, and press Record. Stop to upload.</p><Link href="/settings#recording">Set up recording <ArrowRight size={14}/></Link></article>
      <article className="setup-step"><span className="step-icon"><Sparkles/></span><span className="feature-label">STEP 3</span><h3>Review and follow up</h3><p>Open a saved recording to review the recap, jump through the transcript, and track action items.</p><Link href={meetings.length ? "#recordings" : "/demo"}>{meetings.length ? "View your recordings" : "Explore a sample meeting"} <ArrowRight size={14}/></Link></article>
    </div></section>
    <UpcomingMeetEvents events={events} connected={connected} lastSyncedAt={connections[0]?.lastSyncedAt ?? null}/>
    <MeetingLibrary meetings={meetings.map(meeting => ({ id: meeting.id, title: meeting.title, date: String(meeting.date), status: meeting.status, durationSeconds: meeting.durationSeconds, speakers: meeting.speakers.length, headline: meeting.summaries[0]?.content.headline ?? "Open the recording to review the transcript and recap." }))}/>
  </>;
}

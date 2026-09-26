import Link from "next/link";
import { eq } from "drizzle-orm";
import { Download, Upload } from "lucide-react";
import { UpcomingMeetEvents } from "@/components/calendar/UpcomingMeetEvents";
import { Avatar, AvatarStack } from "@/components/shell/Avatar";
import { listCommitments, type Commitment } from "@/lib/db/commitments";
import { getDb } from "@/lib/db/client";
import { listMeetings } from "@/lib/db/queries";
import { googleConnections } from "@/lib/db/schema";
import { listUpcomingCalendarEvents } from "@/lib/calendar";
import { day, dueLabel, duration, isLate, time } from "@/lib/format";
import type { Meeting } from "@/lib/types";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Meetings" };

const DOWNLOAD_URL = process.env.NEXT_PUBLIC_CAPTURE_DOWNLOAD_URL ?? "https://github.com/ZayanAhmed07/Tally/releases/latest/download/Tally-Capture-Setup.exe";

function weekLabel(iso: string, now: Date) {
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)));
  const date = new Date(iso);
  if (date >= monday) return "This week";
  if (date >= new Date(monday.getTime() - 7 * 86_400_000)) return "Last week";
  return "Earlier";
}

function groupByWeek(meetings: Meeting[], now: Date) {
  const groups = new Map<string, Meeting[]>();
  for (const meeting of meetings) {
    const label = weekLabel(meeting.date, now);
    groups.set(label, [...(groups.get(label) ?? []), meeting]);
  }
  return [...groups.entries()];
}

function owedByPerson(commitments: Commitment[], now: Date) {
  const people = new Map<string, { open: number; late: number }>();
  for (const item of commitments.filter((commitment) => !commitment.completed)) {
    const entry = people.get(item.owner) ?? { open: 0, late: 0 };
    entry.open += 1;
    if (isLate(item.dueDate, false, now)) entry.late += 1;
    people.set(item.owner, entry);
  }
  return [...people.entries()].sort((a, b) => b[1].late - a[1].late || b[1].open - a[1].open);
}

async function calendarState(userId: string) {
  const [events, connections] = await Promise.all([
    listUpcomingCalendarEvents(userId),
    getDb().select({ lastSyncedAt: googleConnections.lastSyncedAt }).from(googleConnections).where(eq(googleConnections.userId, userId))
  ]);
  return { events, connected: connections.length > 0, lastSyncedAt: connections[0]?.lastSyncedAt ?? null };
}

export default async function MeetingsPage() {
  const viewer = await getViewer();
  const now = new Date();
  const [meetings, commitments, calendar] = await Promise.all([
    listMeetings(viewer.workspaceUserId),
    listCommitments(viewer.workspaceUserId),
    viewer.user ? calendarState(viewer.user.id) : null
  ]);
  const colors = new Map(meetings.flatMap((meeting) => meeting.speakers.map((speaker) => [speaker.name, speaker.color] as const)));
  const openByMeeting = new Map<string, number>();
  for (const item of commitments) if (!item.completed) openByMeeting.set(item.meetingId, (openByMeeting.get(item.meetingId) ?? 0) + 1);
  const owed = owedByPerson(commitments, now);
  const late = commitments.filter((item) => isLate(item.dueDate, item.completed, now));

  return <div className="page">
    <div className="page-head">
      <div>
        <h1>Meetings</h1>
        <p>{viewer.isDemo ? "A product team's last two weeks: planning, a customer call, a standup and an interview." : "Everything you've recorded, newest first."}</p>
      </div>
      {viewer.user && <Link className="button" href="/upload"><Upload size={16}/>Upload a recording</Link>}
    </div>

    {calendar && <UpcomingMeetEvents events={calendar.events} connected={calendar.connected} lastSyncedAt={calendar.lastSyncedAt}/>}

    <div className="home">
      <div>
        {meetings.length === 0 && <div className="empty">
          <h3>Your first recap is one recording away</h3>
          <p>Record a call with Tally Capture, or upload a recording you already have. Meetings for <strong>{viewer.user?.email}</strong> appear here.</p>
          <div className="toolbar">
            <a className="button primary" href={DOWNLOAD_URL}><Download size={15}/>Download Tally Capture</a>
            <Link className="button" href="/upload"><Upload size={15}/>Upload a recording</Link>
          </div>
          <p className="faint" style={{ marginTop: 16, fontSize: 13 }}>Recorded something already? Check Tally Capture is signed in as the same email. Or <Link className="text-link" href="/share/q4-planning-review-recap">see what a finished recap looks like</Link>.</p>
        </div>}
        {groupByWeek(meetings, now).map(([label, group]) => <section className="day-group" key={label} aria-label={label}>
          <h2>{label}</h2>
          <ul className="meeting-list">
            {group.map((meeting) => {
              const open = openByMeeting.get(meeting.id) ?? 0;
              return <li key={meeting.id}>
                <Link className="meeting-row" href={`/meetings/${meeting.id}`}>
                  <div className="meeting-when"><strong>{day(meeting.date)}</strong><span className="faint mono">{time(meeting.date)}</span></div>
                  <div>
                    <div className="meeting-title">{meeting.title}</div>
                    <p className="meeting-headline">{meeting.status === "processing" ? "Transcribing and writing the recap…" : meeting.summaries[0]?.content.headline ?? "Open to review the transcript."}</p>
                    <div className="meeting-meta"><AvatarStack people={meeting.speakers}/><span>{meeting.speakers.length} people</span><span aria-hidden="true">·</span><span>{duration(meeting.durationSeconds)}</span></div>
                  </div>
                  <div className="meeting-side">
                    {meeting.status === "processing" ? <span className="badge processing">Processing</span> : meeting.status === "failed" ? <span className="badge failed">Failed</span> : open > 0 ? <span className="badge">{open} open</span> : <span className="badge done">All done</span>}
                  </div>
                </Link>
              </li>;
            })}
          </ul>
        </section>)}
      </div>

      <aside>
        {owed.length > 0 && <section className="aside-card" aria-labelledby="owed-title">
          <header><h2 id="owed-title">Who owes what</h2><p>Open commitments across every meeting.</p></header>
          <ul className="owed-list">
            {owed.map(([name, count]) => <li key={name}><Link href={`/actions?owner=${encodeURIComponent(name)}`}>
              <Avatar name={name} color={colors.get(name)}/><span>{name}</span>
              <span className="owed-count">{count.late > 0 && <span className="badge late">{count.late} late</span>}<span className="badge">{count.open}</span></span>
            </Link></li>)}
          </ul>
        </section>}
        {late.length > 0 && <section className="aside-card" aria-labelledby="late-title">
          <header><h2 id="late-title">Slipping</h2><p>Past due and still open.</p></header>
          <ul className="late-list">
            {late.slice(0, 4).map((item) => <li key={item.id}><Link href={`/meetings/${item.meetingId}?action=${item.id}`}>
              <div className="late-text">{item.text}</div>
              <div className="late-meta">{item.owner.split(" ")[0]} · {dueLabel(item.dueDate, false, now)}{item.mentions.length > 0 ? " · raised again" : ""}</div>
            </Link></li>)}
          </ul>
        </section>}
      </aside>
    </div>
  </div>;
}

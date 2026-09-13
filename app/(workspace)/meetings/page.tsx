import Link from "next/link";
import { listMeetings } from "@/lib/db/queries";
import { requireUser } from "@/lib/auth";
import { listUpcomingCalendarEvents } from "@/lib/calendar";
import { UpcomingMeetEvents } from "@/components/calendar/UpcomingMeetEvents";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Clock, Users } from "lucide-react";

export default async function MeetingsPage() {
  const user = await requireUser();
  const [meetings, events] = await Promise.all([listMeetings(user.id), listUpcomingCalendarEvents(user.id)]);
  return <><div className="page-head"><div><p className="eyebrow">Post-meeting workspace</p><h1>Meetings</h1><p className="muted">Live and upcoming Google Meet events stay manual: open the call, choose a source, then press Record.</p></div><Link className="button primary" href="/upload">Upload</Link></div><UpcomingMeetEvents events={events} /><div className="grid cards">{meetings.map((meeting) => <Link className="card" key={meeting.id} href={`/meetings/${meeting.id}`}><div className="toolbar" style={{justifyContent:"space-between"}}><StatusBadge status={meeting.status}/><span className="muted">{new Date(meeting.date).toLocaleDateString()}</span></div><h2>{meeting.title}</h2><p className="muted">{meeting.summaries[0]?.content.headline ?? "Open this meeting to review the workspace."}</p><div className="toolbar"><span className="badge"><Clock size={14}/>{Math.round(meeting.durationSeconds / 60)} min</span><span className="badge"><Users size={14}/>{meeting.speakers.length}</span></div></Link>)}</div></>;
}
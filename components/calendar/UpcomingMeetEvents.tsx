import { CalendarClock, MonitorDot, Video } from "lucide-react";

type Event = { id: string; title: string; startTime: Date; endTime: Date; attendeeCount: number; meetUrl: string; state: string };

function handoffUrl(event: Event) {
  const url = new URL("fathom-clone://record");
  url.searchParams.set("eventId", event.id);
  url.searchParams.set("title", event.title);
  url.searchParams.set("meetUrl", event.meetUrl);
  return url.toString();
}

function stateClass(state: string) {
  const value = state.toLowerCase();
  if (value.includes("live")) return "live";
  if (value.includes("soon")) return "processing";
  if (value.includes("ended")) return "ready";
  return "";
}

export function UpcomingMeetEvents({ events }: { events: Event[] }) {
  if (events.length === 0) return <section className="card" style={{marginBottom:18}}><div className="toolbar"><CalendarClock color="var(--cyan)"/><h2>Google Meet events</h2></div><p className="muted">No upcoming Google Meet events synced yet.</p></section>;
  return <section className="card" style={{marginBottom:18}}><div className="toolbar"><CalendarClock color="var(--cyan)"/><h2>Google Meet events</h2></div><div className="grid">{events.map((event) => <div className="meeting-row" key={event.id}><div><strong>{event.title}</strong><p className="muted">{event.startTime.toLocaleString()} - {event.endTime.toLocaleTimeString()} - {event.attendeeCount} attendees</p></div><div className="toolbar"><span className={`badge ${stateClass(event.state)}`}>{event.state}</span><a className="button" href={event.meetUrl} target="_blank" rel="noreferrer"><Video size={17}/>Open Meet</a><a className="button primary" href={handoffUrl(event)}><MonitorDot size={17}/>Record with desktop agent</a></div></div>)}</div></section>;
}

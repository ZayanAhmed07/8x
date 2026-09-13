import { CalendarClock, MonitorDot, Video } from "lucide-react";

type Event = { id: string; title: string; startTime: Date; endTime: Date; attendeeCount: number; meetUrl: string; state: string };

function handoffUrl(event: Event) {
  const url = new URL("fathom-clone://record");
  url.searchParams.set("eventId", event.id);
  url.searchParams.set("title", event.title);
  url.searchParams.set("meetUrl", event.meetUrl);
  return url.toString();
}

export function UpcomingMeetEvents({ events }: { events: Event[] }) {
  if (events.length === 0) return <section className="card" style={{marginBottom:18}}><div className="toolbar"><CalendarClock color="#b85042"/><h2>Google Meet events</h2></div><p className="muted">No upcoming Google Meet events synced yet.</p></section>;
  return <section className="card" style={{marginBottom:18}}><div className="toolbar"><CalendarClock color="#b85042"/><h2>Google Meet events</h2></div><div className="grid">{events.map((event) => <div className="meeting-row" key={event.id}><div><strong>{event.title}</strong><p className="muted">{event.startTime.toLocaleString()} - {event.endTime.toLocaleTimeString()} · {event.attendeeCount} attendees</p></div><div className="toolbar"><span className={`badge ${event.state === "live" ? "ready" : event.state === "starting soon" ? "processing" : ""}`}>{event.state}</span><a className="button" href={event.meetUrl} target="_blank" rel="noreferrer"><Video size={17}/>Open Meet</a><a className="button primary" href={handoffUrl(event)}><MonitorDot size={17}/>Record with desktop agent</a></div></div>)}</div></section>;
}
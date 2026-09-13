import Link from "next/link";
import { CalendarControls } from "./CalendarControls";
﻿import { CalendarClock, MonitorDot, Video } from "lucide-react";

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

export function UpcomingMeetEvents({ events, connected = false, lastSyncedAt }: { events: Event[]; connected?: boolean; lastSyncedAt?: Date | null }) {
  return <section className="card upcoming-section"><div className="section-heading"><div><h2>Upcoming meetings</h2><p className="muted">{connected ? "Google Meet calls in the next 14 days" : "Connect your calendar to see your schedule here"}</p></div>{connected && <CalendarControls connected compact/>}</div>
    {events.length === 0 ? <div className="calendar-empty"><CalendarClock size={32}/><div><h3>{!connected ? "Bring your schedule into Fathom" : lastSyncedAt ? "No upcoming Google Meet calls" : "Your calendar is ready to sync"}</h3><p className="muted">{!connected ? "Start with Connect Google Calendar above. Choose your Google account and allow read-only calendar access." : lastSyncedAt ? "Add a Google Meet link to an event on your primary Google Calendar, then sync again." : "Click Sync calendar to load your upcoming calls."}</p>{connected && <a className="text-link" href="https://calendar.google.com" target="_blank" rel="noreferrer">Open Google Calendar</a>}</div></div> : <><p className="recording-help">To capture a call: join Google Meet, then open the recorder and press Record. <Link href="/settings#recording">Recording setup</Link></p><div className="grid">{events.map(event => <div className="meeting-row" key={event.id}><div><strong>{event.title}</strong><p className="muted">{event.startTime.toLocaleString()} - {event.endTime.toLocaleTimeString()} &middot; {event.attendeeCount} attendees</p></div><div className="toolbar"><span className={`badge ${stateClass(event.state)}`}>{event.state}</span><a className="button" href={event.meetUrl} target="_blank" rel="noreferrer"><Video size={17}/>Join meeting</a><a className="button primary" href={handoffUrl(event)}><MonitorDot size={17}/>Open recorder</a></div></div>)}</div></>}
  </section>;
}

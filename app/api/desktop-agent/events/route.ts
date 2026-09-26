import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/api/agent";
import { listUpcomingCalendarEvents, syncGoogleMeetEvents } from "@/lib/calendar";

/** Upcoming Google Meet calls for the desktop app's "Up next" list. Syncs first when asked. */
export async function GET(request: Request) {
  const agent = await requireAgent(request);
  if ("response" in agent) return agent.response;
  if (new URL(request.url).searchParams.get("sync") === "1") await syncGoogleMeetEvents(agent.userId).catch(() => undefined);
  const events = await listUpcomingCalendarEvents(agent.userId);
  return NextResponse.json({ events: events.map((event) => ({ id: event.id, title: event.title, startTime: event.startTime.toISOString(), endTime: event.endTime.toISOString(), meetUrl: event.meetUrl, attendeeCount: event.attendeeCount, state: event.state })) });
}

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import type { Track } from "@/lib/ai/pipeline";
import { jsonError, requireAgent } from "@/lib/api/agent";
import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { isRecordingId, objectPath, parseTimeline, startProcessing, uploadedFiles } from "@/lib/recordings";
import { displayNameFor } from "@/lib/storage";

// Transcription and summarising run after the response, within this budget.
export const maxDuration = 300;

/** Step 2: the tracks are uploaded. Create the meeting and process it in the background. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [agent, { id }] = await Promise.all([requireAgent(request), params]);
  if ("response" in agent) return agent.response;
  if (!isRecordingId(id)) return jsonError("Unknown recording.", 404);
  const body = await request.json().catch(() => ({}));
  const files = await uploadedFiles(agent.userId, id);
  if (!files.has("mix.webm")) return jsonError("The upload didn't finish. Retry from Tally Capture.", 409);

  const you = await displayNameFor(agent.userId);
  const track = (name: string, speakerName: string): Track => ({ objectPath: objectPath(agent.userId, id, name), speakerName, contentType: "audio/webm" });
  // Separate tracks: the mic is you, the computer's audio is everyone else.
  const tracks = files.has("mic.webm") && files.has("system.webm")
    ? [track("mic.webm", you), track("system.webm", "Others on the call")]
    : [track(files.has("mic.webm") ? "mic.webm" : "mix.webm", you)];

  const status = await startProcessing({
    userId: agent.userId,
    meetingId: id,
    title: typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 120) : "Untitled meeting",
    startedAt: typeof body.startedAt === "string" ? new Date(body.startedAt) : undefined,
    durationSeconds: Number(body.durationSeconds) || 1,
    media: { name: "mix.webm", kind: "audio" },
    tracks,
    calendarEventId: typeof body.calendarEventId === "string" ? body.calendarEventId.slice(0, 96) : undefined,
    // Speaker names from the Tally for Meet extension, when it was running during the call.
    timeline: parseTimeline(body.speakerTimeline)
  });
  return NextResponse.json({ meetingId: id, status }, { status: 202 });
}

/** Step 3: the app polls until the recap is ready. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [agent, { id }] = await Promise.all([requireAgent(request), params]);
  if ("response" in agent) return agent.response;
  const [meeting] = await getDb().select({ status: schema.meetings.status, title: schema.meetings.title }).from(schema.meetings).where(and(eq(schema.meetings.id, id), eq(schema.meetings.userId, agent.userId)));
  return meeting ? NextResponse.json({ meetingId: id, ...meeting }) : jsonError("Unknown recording.", 404);
}

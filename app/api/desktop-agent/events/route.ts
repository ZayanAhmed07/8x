import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { fallbackMeetingContent, summarizeTranscript, transcribeRecording } from "@/lib/ai/summarize";
import { listUpcomingCalendarEvents, userIdFromAgentToken } from "@/lib/calendar";
import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;
const BUCKET = "recordings";
const ALLOWED_TYPES = new Map([
  ["video/webm", "webm"],
  ["video/mp4", "mp4"],
  ["audio/mp4", "m4a"],
  ["audio/mpeg", "mp3"],
  ["audio/mp3", "mp3"],
  ["audio/wav", "wav"],
  ["audio/x-wav", "wav"]
]);

function jsonError(message: string, status = 400, meetingId?: string) {
  return NextResponse.json({ error: message, meetingId }, { status });
}

function slug(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 64) || "meeting-recording";
}

function cleanId(value: unknown) {
  return typeof value === "string" ? value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120) : "";
}

function cleanPath(value: unknown) {
  return typeof value === "string" ? value.replace(/[^a-zA-Z0-9/_\-.]/g, "").slice(0, 360) : "";
}

function extensionFor(fileName: string, contentType: string) {
  const byType = ALLOWED_TYPES.get(contentType);
  const byName = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (byType && (!byName || ["webm", "mp4", "m4a", "mp3", "wav"].includes(byName))) return byType;
  if (byName && ["webm", "mp4", "m4a", "mp3", "wav"].includes(byName)) return byName;
  return null;
}

function serviceClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function prepareUpload(ownerId: string, body: { fileName?: unknown; contentType?: unknown; size?: unknown }) {
  const fileName = typeof body.fileName === "string" && body.fileName.trim() ? body.fileName.trim().slice(0, 140) : "recording.webm";
  const contentType = typeof body.contentType === "string" && body.contentType.trim() ? body.contentType.trim() : "video/webm";
  const size = Number(body.size ?? 0);
  const extension = extensionFor(fileName, contentType);

  if (!extension) return jsonError("Recording must be a .webm, .mp4, .m4a, .mp3, or .wav file.");
  if (!Number.isFinite(size) || size <= 0) return jsonError("Recording file is empty.");
  if (size > MAX_UPLOAD_BYTES) return jsonError("Recording is larger than the 250MB limit.", 413);

  const supabase = serviceClient();
  if (!supabase) return jsonError("Supabase server environment is not configured.", 500);

  const meetingId = `capture-${randomUUID()}`;
  const objectPath = `${ownerId}/${meetingId}/${slug(fileName)}.${extension}`;
  const signed = await supabase.storage.from(BUCKET).createSignedUploadUrl(objectPath);
  if (signed.error || !signed.data?.signedUrl) {
    return jsonError(`Could not prepare recording upload: ${signed.error?.message ?? "Missing signed URL."}`, 500);
  }

  return NextResponse.json({ meetingId, objectPath, signedUrl: signed.data.signedUrl, token: signed.data.token });
}

async function finalizeRecording(ownerId: string, body: { meetingId?: unknown; objectPath?: unknown; title?: unknown; durationSeconds?: unknown; calendarEventId?: unknown; contentType?: unknown; fileName?: unknown }) {
  const meetingId = cleanId(body.meetingId);
  const objectPath = cleanPath(body.objectPath);
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 120) : "Captured meeting";
  const durationSeconds = Math.max(1, Math.round(Number(body.durationSeconds ?? 1)));
  const calendarEventId = cleanId(body.calendarEventId);
  const contentType = typeof body.contentType === "string" && body.contentType.trim() ? body.contentType.trim() : "video/webm";
  const fileName = typeof body.fileName === "string" && body.fileName.trim() ? body.fileName.trim().slice(0, 140) : "recording.webm";

  if (!meetingId.startsWith("capture-")) return jsonError("Invalid recording id.");
  if (!objectPath.startsWith(`${ownerId}/${meetingId}/`)) return jsonError("Invalid recording storage path.");

  const supabase = serviceClient();
  if (!supabase) return jsonError("Supabase server environment is not configured.", 500);

  const db = getDb();
  if (calendarEventId) {
    const [event] = await db.select().from(schema.calendarEvents).where(and(eq(schema.calendarEvents.id, calendarEventId), eq(schema.calendarEvents.userId, ownerId)));
    if (!event) return jsonError("Calendar event was not found for this user.", 404);
  }

  const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  const download = await supabase.storage.from(BUCKET).download(objectPath);
  if (download.error || !download.data) {
    return jsonError(`Recording upload could not be found: ${download.error?.message ?? "Missing storage object."}`, 404);
  }

  const speakerId = `${meetingId}-speaker-you`;
  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.meetings).values({
        id: meetingId,
        userId: ownerId,
        title,
        date: new Date(),
        durationSeconds,
        status: "processing",
        videoUrl: publicUrl.publicUrl,
        summaryTemplate: "general",
        shareToken: `${meetingId}-public`
      });
      await tx.insert(schema.speakers).values({ id: speakerId, meetingId, name: "You", avatarUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent("You")}`, color: "#FF5DA2" });
      await tx.insert(schema.meetingAttendees).values({ meetingId, speakerId });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database insert failed.";
    return jsonError(`Recording uploaded, but meeting creation failed: ${message}`, 500, meetingId);
  }

  try {
    const file = new File([download.data], fileName, { type: contentType });
    const transcribed = await transcribeRecording(file);
    const segments = transcribed?.length ? transcribed : [{ startMs: 0, endMs: durationSeconds * 1000, text: "Recording uploaded successfully. Automatic transcription requires GROQ_API_KEY." }];
    const transcriptText = segments.map((segment) => segment.text).join("\n");
    const content = transcribed?.length ? await summarizeTranscript(transcriptText) : fallbackMeetingContent(transcriptText, false);
    const actualDurationSeconds = Math.max(durationSeconds, Math.ceil(Math.max(...segments.map((segment) => segment.endMs)) / 1000));

    await db.transaction(async (tx) => {
      await tx.insert(schema.transcriptSegments).values(segments.map((segment, index) => ({ id: `${meetingId}-segment-${index + 1}`, meetingId, speakerId, startMs: segment.startMs, endMs: segment.endMs, text: segment.text, chapterId: null })));
      await tx.insert(schema.summaries).values({ id: `${meetingId}-summary-general`, meetingId, template: "general", contentJson: content });
      if (content.actionItems.length > 0) {
        await tx.insert(schema.actionItems).values(content.actionItems.map((item, index) => ({ id: `${meetingId}-action-${index + 1}`, meetingId, text: item.text, owner: item.owner, dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), completed: false, sourceSegmentId: `${meetingId}-segment-1` })));
      }
      await tx.update(schema.meetings).set({ status: "ready", durationSeconds: actualDurationSeconds }).where(eq(schema.meetings.id, meetingId));
      if (calendarEventId) await tx.update(schema.calendarEvents).set({ meetingId }).where(and(eq(schema.calendarEvents.id, calendarEventId), eq(schema.calendarEvents.userId, ownerId)));
    });
  } catch (error) {
    await db.update(schema.meetings).set({ status: "failed" }).where(eq(schema.meetings.id, meetingId));
    const message = error instanceof Error ? error.message : "Processing failed.";
    return jsonError(`Recording uploaded, but processing failed: ${message}`, 500, meetingId);
  }

  return NextResponse.json({ meetingId, status: "ready", videoUrl: publicUrl.publicUrl }, { status: 201 });
}

export async function GET(request: Request) {
  const userId = await userIdFromAgentToken(request.headers.get("authorization"));
  if (!userId) return jsonError("Desktop agent is not paired.", 401);
  const events = await listUpcomingCalendarEvents(userId);
  return NextResponse.json({ events });
}

export async function POST(request: Request) {
  const userId = await userIdFromAgentToken(request.headers.get("authorization"));
  if (!userId) return jsonError("Desktop agent is not paired.", 401);

  const body = await request.json().catch(() => null) as ({ action?: unknown } & Record<string, unknown>) | null;
  if (!body) return jsonError("Invalid desktop agent request.");
  if (body.action === "prepare-upload") return prepareUpload(userId, body);
  if (body.action === "finalize-recording") return finalizeRecording(userId, body);
  return jsonError("Unknown desktop agent action.");
}

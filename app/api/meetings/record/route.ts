import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { userIdFromAgentToken } from "@/lib/calendar";
import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { fallbackMeetingContent, summarizeTranscript, transcribeRecording } from "@/lib/ai/summarize";

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

function slug(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 64) || "meeting-recording";
}

function jsonError(message: string, status = 400, meetingId?: string) {
  return NextResponse.json({ error: message, meetingId }, { status });
}

function extensionFor(file: File) {
  const byType = ALLOWED_TYPES.get(file.type);
  const byName = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (byType && (!byName || ["webm", "mp4", "m4a", "mp3", "wav"].includes(byName))) return byType;
  if (byName && ["webm", "mp4", "m4a", "mp3", "wav"].includes(byName)) return byName;
  return null;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const agentUserId = user ? null : await userIdFromAgentToken(request.headers.get("authorization"));
  const ownerId = user?.id ?? agentUserId;
  if (!ownerId) return jsonError("Authentication required.", 401);

  const form = await request.formData().catch(() => null);
  if (!form) return jsonError("Invalid multipart form data.");

  const file = form.get("recording");
  const titleValue = form.get("title");
  const calendarEventIdValue = form.get("calendarEventId");
  if (!(file instanceof File)) return jsonError("Missing recording file.");

  const extension = extensionFor(file);
  if (!extension) return jsonError("Upload must be a .webm, .mp4, .m4a, .mp3, or .wav recording.");
  if (file.size <= 0) return jsonError("Recording file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) return jsonError("Recording is larger than the 250MB limit.", 413);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonError("Supabase server environment is not configured.", 500);
  }

  const title = typeof titleValue === "string" && titleValue.trim() ? titleValue.trim().slice(0, 120) : "Uploaded meeting";
  const calendarEventId = typeof calendarEventIdValue === "string" ? calendarEventIdValue.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 96) : "";
  const meetingId = `upload-${randomUUID()}`;
  const speakerId = `${meetingId}-speaker-you`;
  const objectPath = `${meetingId}/${slug(file.name || title)}.${extension}`;

  if (calendarEventId) {
    const [event] = await getDb().select().from(schema.calendarEvents).where(and(eq(schema.calendarEvents.id, calendarEventId), eq(schema.calendarEvents.userId, ownerId)));
    if (!event) return jsonError("Calendar event was not found for this user.", 404);
  }

  const supabase = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const upload = await supabase.storage.from(BUCKET).upload(objectPath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false
  });
  if (upload.error) return jsonError(`Recording upload failed: ${upload.error.message}`, 500);

  const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  const db = getDb();

  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.meetings).values({
        id: meetingId,
        userId: ownerId,
        title,
        date: new Date(),
        durationSeconds: 1,
        status: "processing",
        videoUrl: publicUrl.publicUrl,
        summaryTemplate: "general",
        shareToken: `${meetingId}-public`
      });
      await tx.insert(schema.speakers).values({ id: speakerId, meetingId, name: "You", avatarUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent("You")}`, color: "#b85042" });
      await tx.insert(schema.meetingAttendees).values({ meetingId, speakerId });
    });
  } catch (error) {
    await supabase.storage.from(BUCKET).remove([objectPath]);
    const message = error instanceof Error ? error.message : "Database insert failed.";
    return jsonError(`Recording uploaded, but meeting creation failed: ${message}`, 500);
  }

  try {
    const transcribed = await transcribeRecording(file);
    const segments = transcribed?.length ? transcribed : [{ startMs: 0, endMs: 1000, text: "Recording uploaded successfully. Automatic transcription requires GROQ_API_KEY." }];
    const transcriptText = segments.map((segment) => segment.text).join("\n");
    const content = transcribed?.length ? await summarizeTranscript(transcriptText) : fallbackMeetingContent(transcriptText, false);
    const durationSeconds = Math.max(1, Math.ceil(Math.max(...segments.map((segment) => segment.endMs)) / 1000));

    await db.transaction(async (tx) => {
      await tx.insert(schema.transcriptSegments).values(segments.map((segment, index) => ({ id: `${meetingId}-segment-${index + 1}`, meetingId, speakerId, startMs: segment.startMs, endMs: segment.endMs, text: segment.text, chapterId: null })));
      await tx.insert(schema.summaries).values({ id: `${meetingId}-summary-general`, meetingId, template: "general", contentJson: content });
      if (content.actionItems.length > 0) {
        await tx.insert(schema.actionItems).values(content.actionItems.map((item, index) => ({ id: `${meetingId}-action-${index + 1}`, meetingId, text: item.text, owner: item.owner, dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), completed: false, sourceSegmentId: `${meetingId}-segment-1` })));
      }
      await tx.update(schema.meetings).set({ status: "ready", durationSeconds }).where(eq(schema.meetings.id, meetingId));
      if (calendarEventId) await tx.update(schema.calendarEvents).set({ meetingId }).where(and(eq(schema.calendarEvents.id, calendarEventId), eq(schema.calendarEvents.userId, ownerId)));
    });
  } catch (error) {
    await db.update(schema.meetings).set({ status: "failed" }).where(eq(schema.meetings.id, meetingId));
    const message = error instanceof Error ? error.message : "Processing failed.";
    return jsonError(`Recording uploaded, but processing failed: ${message}`, 500, meetingId);
  }

  return NextResponse.json({ meetingId, status: "ready", videoUrl: publicUrl.publicUrl }, { status: 201 });
}

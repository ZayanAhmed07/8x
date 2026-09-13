import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;
const BUCKET = "recordings";

function slug(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 64) || "captured-meeting";
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonError("Supabase server environment is not configured.", 500);
  }

  const form = await request.formData().catch(() => null);
  if (!form) return jsonError("Invalid multipart form data.");

  const file = form.get("recording");
  const titleValue = form.get("title");
  const durationValue = form.get("duration");

  if (!(file instanceof File)) return jsonError("Missing recording file.");
  if (file.type !== "video/webm") return jsonError("Recording must be a video/webm file.");
  if (file.size <= 0) return jsonError("Recording file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) return jsonError("Recording is larger than the 250MB limit.", 413);

  const title = typeof titleValue === "string" && titleValue.trim() ? titleValue.trim().slice(0, 120) : "Captured meeting";
  const durationSeconds = Math.max(1, Math.min(24 * 60 * 60, Number(durationValue) || 1));
  const meetingId = `recording-${randomUUID()}`;
  const speakerId = `${meetingId}-speaker-you`;
  const transcriptId = `${meetingId}-segment-placeholder`;
  const summaryId = `${meetingId}-summary-general`;
  const objectPath = `${meetingId}/${slug(title)}.webm`;

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const upload = await supabase.storage.from(BUCKET).upload(objectPath, file, {
    contentType: "video/webm",
    upsert: false
  });

  if (upload.error) {
    return jsonError(`Recording upload failed: ${upload.error.message}`, 500);
  }

  const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);

  try {
    const db = getDb();
    await db.transaction(async (tx) => {
      await tx.insert(schema.meetings).values({
        id: meetingId,
        title,
        date: new Date(),
        durationSeconds,
        status: "ready",
        videoUrl: publicUrl.publicUrl,
        summaryTemplate: "general",
        shareToken: `${meetingId}-public`
      });

      await tx.insert(schema.speakers).values({
        id: speakerId,
        meetingId,
        name: "You",
        avatarUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent("You")}`,
        color: "#b85042"
      });

      await tx.insert(schema.transcriptSegments).values({
        id: transcriptId,
        meetingId,
        speakerId,
        startMs: 0,
        endMs: durationSeconds * 1000,
        text: "Recording captured. Live transcription requires GROQ_API_KEY.",
        chapterId: null
      });

      await tx.insert(schema.summaries).values({
        id: summaryId,
        meetingId,
        template: "general",
        contentJson: {
          headline: "Recording captured and ready for review.",
          bullets: ["The desktop agent uploaded this recording successfully.", "Tier 1 uses a placeholder transcript until live transcription is enabled."],
          decisions: ["Review the captured recording from the meeting detail page."],
          keyQuotes: ["Recording captured. Live transcription requires GROQ_API_KEY."]
        }
      });

      await tx.insert(schema.meetingAttendees).values({ meetingId, speakerId });
    });
  } catch (error) {
    await supabase.storage.from(BUCKET).remove([objectPath]);
    const message = error instanceof Error ? error.message : "Database insert failed.";
    return jsonError(`Recording uploaded, but meeting creation failed: ${message}`, 500);
  }

  return NextResponse.json({ meetingId, status: "ready", videoUrl: publicUrl.publicUrl }, { status: 201 });
}

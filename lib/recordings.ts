import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { processRecording, type SpeakerTimeline, type Track } from "@/lib/ai/pipeline";
import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { RECORDINGS_BUCKET, storageClient, storageRef } from "@/lib/storage";

// Files go straight from the client to storage through signed URLs (serverless request
// bodies are capped at a few MB), then a second call creates the meeting and processes
// it in the background.

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MEETING_ID = /^capture-[0-9a-f-]{36}$/;

export const newRecordingId = () => `capture-${randomUUID()}`;
export const isRecordingId = (id: string) => MEETING_ID.test(id);
const folder = (userId: string, meetingId: string) => `${userId}/${meetingId}`;
export const objectPath = (userId: string, meetingId: string, name: string) => `${folder(userId, meetingId)}/${name}`;

export async function signUploads(userId: string, meetingId: string, names: string[]) {
  const uploads = [];
  for (const name of names) {
    const path = objectPath(userId, meetingId, name);
    const { data, error } = await storageClient().storage.from(RECORDINGS_BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw new Error(`Couldn't prepare the upload: ${error?.message ?? "no URL"}`);
    uploads.push({ name, objectPath: path, signedUrl: data.signedUrl });
  }
  return uploads;
}

/** Names of the files that actually arrived, so a half-finished upload can't become a meeting. */
export async function uploadedFiles(userId: string, meetingId: string) {
  const { data } = await storageClient().storage.from(RECORDINGS_BUCKET).list(folder(userId, meetingId));
  return new Set((data ?? []).filter((file) => (file.metadata?.size ?? 0) > 0).map((file) => file.name));
}

type Start = { userId: string; meetingId: string; title: string; startedAt?: Date; durationSeconds: number; media: { name: string; kind: "audio" | "video" }; tracks: Track[]; calendarEventId?: string; timeline?: SpeakerTimeline };

/** Validates the speaker timeline the desktop app relays from the Meet extension. */
export function parseTimeline(value: unknown): SpeakerTimeline | undefined {
  const input = value as { startedAtMs?: unknown; pauses?: unknown; events?: unknown } | null;
  if (!input || !Number.isFinite(input.startedAtMs) || !Array.isArray(input.events)) return undefined;
  const events = input.events
    .filter((event): event is { t: number; name: string } => Number.isFinite(event?.t) && typeof event?.name === "string" && event.name.trim().length > 0)
    .slice(0, 20_000)
    .map((event) => ({ t: event.t, name: event.name.trim().slice(0, 60) }));
  const pauses = (Array.isArray(input.pauses) ? input.pauses : [])
    .filter((pause): pause is { startMs: number; endMs: number } => Number.isFinite(pause?.startMs) && Number.isFinite(pause?.endMs) && pause.endMs > pause.startMs)
    .slice(0, 500);
  return events.length ? { startedAtMs: Number(input.startedAtMs), pauses, events } : undefined;
}

/** Creates the meeting in "processing" and schedules transcription after the response. Idempotent per id. */
export async function startProcessing({ userId, meetingId, title, startedAt, durationSeconds, media, tracks, calendarEventId, timeline }: Start) {
  const db = getDb();
  const [existing] = await db.select({ status: schema.meetings.status }).from(schema.meetings).where(eq(schema.meetings.id, meetingId));
  if (existing) return existing.status;
  const date = startedAt && !Number.isNaN(startedAt.getTime()) ? startedAt : new Date();
  await db.insert(schema.meetings).values({ id: meetingId, userId, title, date, durationSeconds: Math.max(1, Math.round(durationSeconds)), status: "processing", videoUrl: storageRef(objectPath(userId, meetingId, media.name)), mediaKind: media.kind, summaryTemplate: "general", shareToken: randomUUID() });
  if (calendarEventId) await db.update(schema.calendarEvents).set({ meetingId }).where(and(eq(schema.calendarEvents.id, calendarEventId), eq(schema.calendarEvents.userId, userId)));
  after(() => processRecording(meetingId, tracks, title, timeline));
  return "processing";
}

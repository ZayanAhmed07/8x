import { existsSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { count, eq, inArray } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";
import { seedMeetings, seedMentions } from "./seed-data";
import { getDb } from "../lib/db/client";
import * as schema from "../lib/db/schema";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    process.env[key] ??= trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
  }
}

/** The sample workspace belongs to a real, confirmed auth user nobody signs in as. */
async function ensureDemoUser(email: string) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const existing = data.users.find((user) => user.email === email);
    if (existing) return { supabase, userId: existing.id };
    if (data.users.length < 200) break;
  }
  const { data, error } = await supabase.auth.admin.createUser({ email, password: randomBytes(24).toString("base64url"), email_confirm: true, user_metadata: { demo: true } });
  if (error) throw error;
  return { supabase, userId: data.user.id };
}

/** Recordings are private: pages read them through short-lived signed URLs. */
async function ensureRecordingsBucket(supabase: Awaited<ReturnType<typeof ensureDemoUser>>["supabase"]) {
  const options = { public: false, fileSizeLimit: 50 * 1024 * 1024 };
  const { data } = await supabase.storage.getBucket("recordings");
  const { error } = data ? await supabase.storage.updateBucket("recordings", options) : await supabase.storage.createBucket("recordings", options);
  if (error) throw error;
}

async function main() {
  loadEnvFile(".env.local");
  for (const key of ["DATABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`${key} is required to seed`);
  }

  const email = process.env.DEMO_USER_EMAIL ?? "demo@fathom8x.app";
  const { supabase, userId } = await ensureDemoUser(email);
  await ensureRecordingsBucket(supabase);
  const db = getDb();

  // Reset everything the demo user owns, including highlights and toggles visitors made.
  const owned = await db.select({ id: schema.meetings.id }).from(schema.meetings).where(eq(schema.meetings.userId, userId));
  const ids = [...new Set([...owned.map((row) => row.id), ...seedMeetings.map((meeting) => meeting.id)])];

  await db.transaction(async (tx) => {
    await tx.update(schema.calendarEvents).set({ meetingId: null }).where(inArray(schema.calendarEvents.meetingId, ids));
    await tx.delete(schema.actionItemMentions).where(inArray(schema.actionItemMentions.meetingId, ids));
    await tx.delete(schema.meetingAttendees).where(inArray(schema.meetingAttendees.meetingId, ids));
    await tx.delete(schema.highlights).where(inArray(schema.highlights.meetingId, ids));
    await tx.delete(schema.actionItems).where(inArray(schema.actionItems.meetingId, ids));
    await tx.delete(schema.summaries).where(inArray(schema.summaries.meetingId, ids));
    await tx.delete(schema.transcriptSegments).where(inArray(schema.transcriptSegments.meetingId, ids));
    await tx.delete(schema.chapters).where(inArray(schema.chapters.meetingId, ids));
    await tx.delete(schema.speakers).where(inArray(schema.speakers.meetingId, ids));
    await tx.delete(schema.meetings).where(inArray(schema.meetings.id, ids));

    await tx.insert(schema.meetings).values(seedMeetings.map((meeting) => ({
      id: meeting.id,
      userId,
      title: meeting.title,
      date: new Date(meeting.date),
      durationSeconds: meeting.durationSeconds,
      status: meeting.status,
      videoUrl: meeting.videoUrl,
      summaryTemplate: meeting.summaryTemplate,
      shareToken: meeting.shareToken ?? null
    })));
    await tx.insert(schema.speakers).values(seedMeetings.flatMap((meeting) => meeting.speakers));
    await tx.insert(schema.chapters).values(seedMeetings.flatMap((meeting) => meeting.chapters));
    await tx.insert(schema.transcriptSegments).values(seedMeetings.flatMap((meeting) => meeting.transcript.map((segment) => ({ ...segment, chapterId: segment.chapterId ?? null }))));
    await tx.insert(schema.summaries).values(seedMeetings.flatMap((meeting) => meeting.summaries.map((summary) => ({ id: `${meeting.id}-${summary.template}`, meetingId: meeting.id, template: summary.template, contentJson: summary.content }))));
    await tx.insert(schema.actionItems).values(seedMeetings.flatMap((meeting) => meeting.actionItems.map((item) => ({
      id: item.id,
      meetingId: item.meetingId,
      text: item.text,
      owner: item.owner,
      dueDate: new Date(`${item.dueDate}T00:00:00.000Z`),
      completed: item.completed,
      sourceSegmentId: item.sourceSegmentId ?? null
    }))));
    await tx.insert(schema.highlights).values(seedMeetings.flatMap((meeting) => meeting.highlights));
    await tx.insert(schema.actionItemMentions).values(seedMentions.map((mention) => ({ id: `${mention.actionId}@${mention.segmentId}`, actionItemId: mention.actionId, meetingId: mention.meetingId, segmentId: mention.segmentId })));
    await tx.insert(schema.meetingAttendees).values(seedMeetings.flatMap((meeting) => meeting.speakers.map((speaker) => ({ meetingId: meeting.id, speakerId: speaker.id }))));
  });

  const tables = { meetings: schema.meetings, speakers: schema.speakers, chapters: schema.chapters, transcript_segments: schema.transcriptSegments, summaries: schema.summaries, action_items: schema.actionItems, highlights: schema.highlights, action_item_mentions: schema.actionItemMentions };
  console.log(`demo user: ${email} (${userId})`);
  for (const [name, table] of Object.entries(tables)) {
    const [{ value }] = await db.select({ value: count() }).from(table);
    console.log(`${name}: ${value}`);
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});

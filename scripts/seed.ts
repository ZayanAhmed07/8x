import { existsSync, readFileSync } from "node:fs";
import { count, inArray } from "drizzle-orm";
import { meetings as seedMeetings } from "../lib/data";
import { getDb } from "../lib/db/client";
import * as schema from "../lib/db/schema";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  const seen = new Set<string>();
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    if (seen.has(key)) continue;
    const value = trimmed.slice(index + 1).trim().replace(/^[\'\"]|[\'\"]$/g, "");
    process.env[key] = value;
    seen.add(key);
  }
}

async function main() {
  loadEnvFile(".env.local");
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to seed Supabase Postgres");
  }

  const db = getDb();

  const seedMeetingIds = seedMeetings.map((meeting) => meeting.id);

  await db.delete(schema.meetingAttendees).where(inArray(schema.meetingAttendees.meetingId, seedMeetingIds));
  await db.delete(schema.highlights).where(inArray(schema.highlights.meetingId, seedMeetingIds));
  await db.delete(schema.actionItems).where(inArray(schema.actionItems.meetingId, seedMeetingIds));
  await db.delete(schema.summaries).where(inArray(schema.summaries.meetingId, seedMeetingIds));
  await db.delete(schema.transcriptSegments).where(inArray(schema.transcriptSegments.meetingId, seedMeetingIds));
  await db.delete(schema.chapters).where(inArray(schema.chapters.meetingId, seedMeetingIds));
  await db.delete(schema.speakers).where(inArray(schema.speakers.meetingId, seedMeetingIds));
  await db.delete(schema.meetings).where(inArray(schema.meetings.id, seedMeetingIds));

  await db.insert(schema.meetings).values(seedMeetings.map((meeting) => ({
    id: meeting.id,
    title: meeting.title,
    date: new Date(meeting.date),
    durationSeconds: meeting.durationSeconds,
    status: meeting.status,
    videoUrl: meeting.videoUrl,
    summaryTemplate: meeting.summaryTemplate,
    shareToken: meeting.shareToken ?? null
  })));

  await db.insert(schema.speakers).values(seedMeetings.flatMap((meeting) => meeting.speakers.map((speaker) => ({
    id: speaker.id,
    meetingId: speaker.meetingId,
    name: speaker.name,
    avatarUrl: speaker.avatarUrl,
    color: speaker.color
  }))));

  await db.insert(schema.chapters).values(seedMeetings.flatMap((meeting) => meeting.chapters.map((chapter) => ({
    id: chapter.id,
    meetingId: chapter.meetingId,
    title: chapter.title,
    startMs: chapter.startMs,
    endMs: chapter.endMs,
    order: chapter.order
  }))));

  await db.insert(schema.transcriptSegments).values(seedMeetings.flatMap((meeting) => meeting.transcript.map((segment) => ({
    id: segment.id,
    meetingId: segment.meetingId,
    speakerId: segment.speakerId,
    startMs: segment.startMs,
    endMs: segment.endMs,
    text: segment.text,
    chapterId: segment.chapterId ?? null
  }))));

  await db.insert(schema.summaries).values(seedMeetings.flatMap((meeting) => meeting.summaries.map((summary) => ({
    id: `${meeting.id}-${summary.template}`,
    meetingId: meeting.id,
    template: summary.template,
    contentJson: summary.content
  }))));

  await db.insert(schema.actionItems).values(seedMeetings.flatMap((meeting) => meeting.actionItems.map((item) => ({
    id: item.id,
    meetingId: item.meetingId,
    text: item.text,
    owner: item.owner,
    dueDate: new Date(`${item.dueDate}T00:00:00.000Z`),
    completed: item.completed,
    sourceSegmentId: item.sourceSegmentId ?? null
  }))));

  await db.insert(schema.highlights).values(seedMeetings.flatMap((meeting) => meeting.highlights.map((highlight) => ({
    id: highlight.id,
    meetingId: highlight.meetingId,
    startMs: highlight.startMs,
    endMs: highlight.endMs,
    title: highlight.title,
    shareToken: highlight.shareToken
  }))));

  await db.insert(schema.meetingAttendees).values(seedMeetings.flatMap((meeting) => meeting.speakers.map((speaker) => ({
    meetingId: meeting.id,
    speakerId: speaker.id
  }))));

  const counts = {
    meetings: await db.select({ count: count() }).from(schema.meetings),
    speakers: await db.select({ count: count() }).from(schema.speakers),
    chapters: await db.select({ count: count() }).from(schema.chapters),
    transcript_segments: await db.select({ count: count() }).from(schema.transcriptSegments),
    summaries: await db.select({ count: count() }).from(schema.summaries),
    action_items: await db.select({ count: count() }).from(schema.actionItems),
    highlights: await db.select({ count: count() }).from(schema.highlights),
    meeting_attendees: await db.select({ count: count() }).from(schema.meetingAttendees)
  };

  for (const [table, rows] of Object.entries(counts)) {
    console.log(`${table}: ${rows[0]?.count ?? 0}`);
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});








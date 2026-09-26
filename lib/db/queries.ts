import { randomUUID } from "node:crypto";
import { and, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import type { ActionItem, Highlight, Meeting, Speaker, Summary, SummaryTemplate, TranscriptSegment } from "@/lib/types";
import { getDb } from "@/lib/db/client";
import { playableUrl } from "@/lib/storage";
import * as schema from "@/lib/db/schema";

// Every read is scoped to a workspace owner. There is no fallback data: if the database fails, the request fails.

export type SearchResult = { type: "Meeting" | "Transcript" | "Chapter" | "Action"; title: string; href: string; meetingId: string; meetingTitle: string; startMs?: number; speaker?: string };

function actionStatus(completed: boolean): ActionItem["status"] {
  return completed ? "Done" : "Open";
}

function serializeMeeting(row: typeof schema.meetings.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    date: row.date.toISOString(),
    durationSeconds: row.durationSeconds,
    status: row.status as Meeting["status"],
    videoUrl: row.videoUrl,
    mediaKind: row.mediaKind === "audio" ? ("audio" as const) : ("video" as const),
    summaryTemplate: row.summaryTemplate as SummaryTemplate,
    shareToken: row.shareToken ?? undefined
  };
}

function serializeAction(row: typeof schema.actionItems.$inferSelect): ActionItem {
  return { id: row.id, meetingId: row.meetingId, text: row.text, owner: row.owner, dueDate: row.dueDate.toISOString().slice(0, 10), completed: row.completed, status: actionStatus(row.completed), sourceSegmentId: row.sourceSegmentId ?? undefined };
}

function serializeHighlight(row: typeof schema.highlights.$inferSelect): Highlight {
  return { id: row.id, meetingId: row.meetingId, startMs: row.startMs, endMs: row.endMs, title: row.title, shareToken: row.shareToken };
}

export async function listMeetings(userId: string): Promise<Meeting[]> {
  const db = getDb();
  const rows = await db.select().from(schema.meetings).where(eq(schema.meetings.userId, userId)).orderBy(desc(schema.meetings.date));
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return [];
  const [speakers, summaryRows] = await Promise.all([
    db.select().from(schema.speakers).where(inArray(schema.speakers.meetingId, ids)),
    db.select({ meetingId: schema.summaries.meetingId, contentJson: schema.summaries.contentJson }).from(schema.summaries).where(and(inArray(schema.summaries.meetingId, ids), eq(schema.summaries.template, "general")))
  ]);
  return rows.map((row) => {
    const summary = summaryRows.find((item) => item.meetingId === row.id)?.contentJson as Summary["content"] | undefined;
    return {
      ...serializeMeeting(row),
      speakers: speakers.filter((speaker) => speaker.meetingId === row.id) as Speaker[],
      chapters: [],
      transcript: [],
      summaries: summary ? [{ template: "general", content: summary }] : [],
      actionItems: [],
      highlights: []
    };
  });
}

async function loadMeeting(meeting: typeof schema.meetings.$inferSelect): Promise<Meeting> {
  const db = getDb();
  const id = meeting.id;
  const [speakers, chapters, transcript, summaries, actionItems, highlights] = await Promise.all([
    db.select().from(schema.speakers).where(eq(schema.speakers.meetingId, id)),
    db.select().from(schema.chapters).where(eq(schema.chapters.meetingId, id)).orderBy(schema.chapters.order),
    db.select().from(schema.transcriptSegments).where(eq(schema.transcriptSegments.meetingId, id)).orderBy(schema.transcriptSegments.startMs),
    db.select().from(schema.summaries).where(eq(schema.summaries.meetingId, id)),
    db.select().from(schema.actionItems).where(eq(schema.actionItems.meetingId, id)),
    db.select().from(schema.highlights).where(eq(schema.highlights.meetingId, id)).orderBy(schema.highlights.startMs)
  ]);
  return {
    ...serializeMeeting(meeting),
    // Recordings are private; hand the page a short-lived signed URL.
    videoUrl: await playableUrl(meeting.videoUrl),
    speakers: speakers as Speaker[],
    chapters,
    transcript: transcript.map((segment): TranscriptSegment => ({ id: segment.id, meetingId: segment.meetingId, speakerId: segment.speakerId, startMs: segment.startMs, endMs: segment.endMs, text: segment.text, chapterId: segment.chapterId ?? undefined })),
    summaries: summaries.map((summary): Summary => ({ template: summary.template as SummaryTemplate, content: summary.contentJson as Summary["content"] })),
    actionItems: actionItems.map(serializeAction),
    highlights: highlights.map(serializeHighlight)
  };
}

export async function getMeetingById(id: string, userId: string): Promise<Meeting | undefined> {
  const [meeting] = await getDb().select().from(schema.meetings).where(and(eq(schema.meetings.id, id), eq(schema.meetings.userId, userId)));
  return meeting ? loadMeeting(meeting) : undefined;
}

/** Public share links. The token is the only credential, so no owner check. */
export async function getSharedMeetingByToken(token: string): Promise<{ meeting: Meeting; highlight?: Highlight } | undefined> {
  const db = getDb();
  const [byMeeting] = await db.select().from(schema.meetings).where(eq(schema.meetings.shareToken, token));
  if (byMeeting) return { meeting: await loadMeeting(byMeeting) };
  const [byHighlight] = await db.select().from(schema.highlights).where(eq(schema.highlights.shareToken, token));
  if (!byHighlight) return undefined;
  const [meeting] = await db.select().from(schema.meetings).where(eq(schema.meetings.id, byHighlight.meetingId));
  return meeting ? { meeting: await loadMeeting(meeting), highlight: serializeHighlight(byHighlight) } : undefined;
}

export async function listActionBoardItems(userId: string) {
  const rows = await getDb()
    .select({ item: schema.actionItems, meeting: schema.meetings.title })
    .from(schema.actionItems)
    .innerJoin(schema.meetings, eq(schema.actionItems.meetingId, schema.meetings.id))
    .where(eq(schema.meetings.userId, userId));
  return rows.map((row) => ({ ...serializeAction(row.item), meeting: row.meeting }));
}

export async function searchDatabase(query: string, userId: string, meetingId?: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const db = getDb();
  const like = `%${q}%`;
  const owner = meetingId ? and(eq(schema.meetings.userId, userId), eq(schema.meetings.id, meetingId)) : eq(schema.meetings.userId, userId);
  const [meetingRows, transcriptRows, chapterRows, actionRows] = await Promise.all([
    db.select({ title: schema.meetings.title, id: schema.meetings.id, date: schema.meetings.date }).from(schema.meetings).where(and(owner, ilike(schema.meetings.title, like))).limit(8),
    db.select({ text: schema.transcriptSegments.text, meetingId: schema.transcriptSegments.meetingId, startMs: schema.transcriptSegments.startMs, meetingTitle: schema.meetings.title, speaker: schema.speakers.name }).from(schema.transcriptSegments).innerJoin(schema.meetings, eq(schema.transcriptSegments.meetingId, schema.meetings.id)).innerJoin(schema.speakers, eq(schema.transcriptSegments.speakerId, schema.speakers.id)).where(and(owner, ilike(schema.transcriptSegments.text, like))).orderBy(desc(schema.meetings.date), schema.transcriptSegments.startMs).limit(40),
    db.select({ title: schema.chapters.title, meetingId: schema.chapters.meetingId, startMs: schema.chapters.startMs, meetingTitle: schema.meetings.title }).from(schema.chapters).innerJoin(schema.meetings, eq(schema.chapters.meetingId, schema.meetings.id)).where(and(owner, ilike(schema.chapters.title, like))).limit(8),
    db.select({ text: schema.actionItems.text, meetingId: schema.actionItems.meetingId, id: schema.actionItems.id, meetingTitle: schema.meetings.title, owner: schema.actionItems.owner }).from(schema.actionItems).innerJoin(schema.meetings, eq(schema.actionItems.meetingId, schema.meetings.id)).where(and(owner, or(ilike(schema.actionItems.text, like), ilike(schema.actionItems.owner, like)))).limit(12)
  ]);
  return [
    ...meetingRows.map((row): SearchResult => ({ type: "Meeting", title: row.title, href: `/meetings/${row.id}`, meetingId: row.id, meetingTitle: row.title })),
    ...transcriptRows.map((row): SearchResult => ({ type: "Transcript", title: row.text, href: `/meetings/${row.meetingId}?t=${row.startMs}`, meetingId: row.meetingId, meetingTitle: row.meetingTitle, startMs: row.startMs, speaker: row.speaker })),
    ...chapterRows.map((row): SearchResult => ({ type: "Chapter", title: row.title, href: `/meetings/${row.meetingId}?t=${row.startMs}`, meetingId: row.meetingId, meetingTitle: row.meetingTitle, startMs: row.startMs })),
    ...actionRows.map((row): SearchResult => ({ type: "Action", title: row.text, href: `/meetings/${row.meetingId}?action=${row.id}`, meetingId: row.meetingId, meetingTitle: row.meetingTitle, speaker: row.owner }))
  ];
}

/** Transcript segments matching any of the keywords, for Ask. */
export async function findSegments(keywords: string[], userId: string, meetingId?: string) {
  if (keywords.length === 0) return [];
  const owner = meetingId ? and(eq(schema.meetings.userId, userId), eq(schema.meetings.id, meetingId)) : eq(schema.meetings.userId, userId);
  return getDb()
    .select({ id: schema.transcriptSegments.id, text: schema.transcriptSegments.text, startMs: schema.transcriptSegments.startMs, meetingId: schema.meetings.id, meetingTitle: schema.meetings.title, speaker: schema.speakers.name })
    .from(schema.transcriptSegments)
    .innerJoin(schema.meetings, eq(schema.transcriptSegments.meetingId, schema.meetings.id))
    .innerJoin(schema.speakers, eq(schema.transcriptSegments.speakerId, schema.speakers.id))
    .where(and(owner, or(...keywords.map((word) => ilike(schema.transcriptSegments.text, `%${word}%`)))))
    .limit(60);
}

export async function countMeetings(userId: string) {
  const [{ value }] = await getDb().select({ value: count() }).from(schema.meetings).where(eq(schema.meetings.userId, userId));
  return value;
}

export async function setActionCompleted(meetingId: string, id: string, completed: boolean) {
  const [row] = await getDb().update(schema.actionItems).set({ completed }).where(and(eq(schema.actionItems.meetingId, meetingId), eq(schema.actionItems.id, id))).returning();
  return row ? serializeAction(row) : undefined;
}

export async function createHighlight(meetingId: string, startMs: number, endMs: number, title: string) {
  const id = `${meetingId}-hi-${randomUUID().slice(0, 8)}`;
  const [row] = await getDb().insert(schema.highlights).values({ id, meetingId, startMs, endMs, title, shareToken: randomUUID() }).returning();
  return serializeHighlight(row);
}

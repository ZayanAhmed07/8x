import { and, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import type { ActionItem, Chapter, Highlight, Meeting, Speaker, Summary, SummaryTemplate, TranscriptSegment } from "@/lib/data";
import { meetings as fallbackMeetings } from "@/lib/data";
import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

function actionStatus(completed: boolean): ActionItem["status"] {
  return completed ? "Done" : "Open";
}

function serializeMeeting(row: typeof schema.meetings.$inferSelect): Omit<Meeting, "speakers" | "chapters" | "transcript" | "summaries" | "actionItems" | "highlights"> {
  return {
    id: row.id,
    title: row.title,
    date: row.date.toISOString(),
    durationSeconds: row.durationSeconds,
    status: row.status as Meeting["status"],
    videoUrl: row.videoUrl,
    summaryTemplate: row.summaryTemplate as SummaryTemplate,
    shareToken: row.shareToken ?? undefined
  };
}

function serializeAction(row: typeof schema.actionItems.$inferSelect): ActionItem {
  const completed = row.completed;
  return { id: row.id, meetingId: row.meetingId, text: row.text, owner: row.owner, dueDate: row.dueDate.toISOString().slice(0, 10), completed, status: actionStatus(completed), sourceSegmentId: row.sourceSegmentId ?? undefined };
}

export async function listMeetings(): Promise<Meeting[]> {
  try {
    const db = getDb();
    const rows = await db.select().from(schema.meetings).orderBy(desc(schema.meetings.date));
    const speakerCounts = await db.select({ meetingId: schema.speakers.meetingId, count: count() }).from(schema.speakers).groupBy(schema.speakers.meetingId);
    const summaryRows = await db.select({ meetingId: schema.summaries.meetingId, contentJson: schema.summaries.contentJson }).from(schema.summaries).where(eq(schema.summaries.template, "general"));
    return rows.map((row) => {
      const summary = summaryRows.find((item) => item.meetingId === row.id)?.contentJson as Summary["content"] | undefined;
      return { ...serializeMeeting(row), speakers: Array.from({ length: speakerCounts.find((item) => item.meetingId === row.id)?.count ?? 0 }, (_, i) => ({ id: `${row.id}-count-${i}`, meetingId: row.id, name: "", avatarUrl: "", color: "" })), chapters: [], transcript: [], summaries: [{ template: "general", content: summary ?? { headline: "Open this meeting to review the generated workspace.", bullets: [], decisions: [], keyQuotes: [] } }], actionItems: [], highlights: [] };
    });
  } catch {
    return fallbackMeetings;
  }
}

export async function getMeetingById(id: string): Promise<Meeting | undefined> {
  try {
    const db = getDb();
    const [meeting] = await db.select().from(schema.meetings).where(eq(schema.meetings.id, id));
    if (!meeting) return undefined;
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
      speakers: speakers as Speaker[],
      chapters: chapters as Chapter[],
      transcript: transcript.map((segment): TranscriptSegment => ({ id: segment.id, meetingId: segment.meetingId, speakerId: segment.speakerId, startMs: segment.startMs, endMs: segment.endMs, text: segment.text, chapterId: segment.chapterId ?? undefined })),
      summaries: summaries.map((summary): Summary => ({ template: summary.template as SummaryTemplate, content: summary.contentJson as Summary["content"] })),
      actionItems: actionItems.map(serializeAction),
      highlights: highlights.map((highlight): Highlight => ({ id: highlight.id, meetingId: highlight.meetingId, startMs: highlight.startMs, endMs: highlight.endMs, title: highlight.title, shareToken: highlight.shareToken }))
    };
  } catch {
    return fallbackMeetings.find((meeting) => meeting.id === id);
  }
}

export async function getSharedMeetingByToken(token: string): Promise<Meeting | undefined> {
  try {
    const db = getDb();
    const [meetingShare] = await db.select({ id: schema.meetings.id }).from(schema.meetings).where(eq(schema.meetings.shareToken, token));
    const [highlightShare] = await db.select({ meetingId: schema.highlights.meetingId }).from(schema.highlights).where(eq(schema.highlights.shareToken, token));
    return getMeetingById(meetingShare?.id ?? highlightShare?.meetingId ?? "");
  } catch {
    return fallbackMeetings.find((meeting) => meeting.shareToken === token || meeting.highlights.some((highlight) => highlight.shareToken === token));
  }
}

export async function listActionBoardItems() {
  try {
    const db = getDb();
    const rows = await db.select({ id: schema.actionItems.id, meetingId: schema.actionItems.meetingId, text: schema.actionItems.text, owner: schema.actionItems.owner, dueDate: schema.actionItems.dueDate, completed: schema.actionItems.completed, sourceSegmentId: schema.actionItems.sourceSegmentId, meeting: schema.meetings.title }).from(schema.actionItems).innerJoin(schema.meetings, eq(schema.actionItems.meetingId, schema.meetings.id));
    return rows.map((row) => ({ ...serializeAction(row), meeting: row.meeting }));
  } catch {
    return fallbackMeetings.flatMap((meeting) => meeting.actionItems.map((item) => ({ ...item, meeting: meeting.title })));
  }
}

export async function searchDatabase(query: string, options: { fallback?: boolean } = {}) {
  const q = query.trim();
  const shouldFallback = options.fallback ?? true;
  if (!q) return [];
  try {
    const db = getDb();
    const like = `%${q}%`;
    const meetingRows = await db.select({ type: schema.meetings.status, title: schema.meetings.title, id: schema.meetings.id }).from(schema.meetings).where(ilike(schema.meetings.title, like)).limit(8);
    const transcriptRows = await db.select({ text: schema.transcriptSegments.text, meetingId: schema.transcriptSegments.meetingId, startMs: schema.transcriptSegments.startMs }).from(schema.transcriptSegments).where(ilike(schema.transcriptSegments.text, like)).limit(12);
    const chapterRows = await db.select({ title: schema.chapters.title, meetingId: schema.chapters.meetingId, startMs: schema.chapters.startMs }).from(schema.chapters).where(ilike(schema.chapters.title, like)).limit(8);
    const actionRows = await db.select({ text: schema.actionItems.text, meetingId: schema.actionItems.meetingId, id: schema.actionItems.id }).from(schema.actionItems).where(or(ilike(schema.actionItems.text, like), ilike(schema.actionItems.owner, like))).limit(12);
    return [
      ...meetingRows.map((row) => ({ type: "Meeting", title: row.title, href: `/meetings/${row.id}` })),
      ...transcriptRows.map((row) => ({ type: "Transcript", title: row.text, href: `/meetings/${row.meetingId}?t=${row.startMs}` })),
      ...chapterRows.map((row) => ({ type: "Chapter", title: row.title, href: `/meetings/${row.meetingId}?t=${row.startMs}` })),
      ...actionRows.map((row) => ({ type: "Action", title: row.text, href: `/meetings/${row.meetingId}?action=${row.id}` }))
    ];
  } catch (error) {
    if (!shouldFallback) throw error;
    const { searchEverything } = await import("@/lib/data");
    return searchEverything(q);
  }
}

export async function setActionCompleted(meetingId: string, id: string, completed: boolean) {
  const db = getDb();
  const [row] = await db.update(schema.actionItems).set({ completed }).where(and(eq(schema.actionItems.meetingId, meetingId), eq(schema.actionItems.id, id))).returning();
  return row ? serializeAction(row) : undefined;
}

export async function createHighlight(meetingId: string, startMs: number, endMs: number, title: string) {
  const db = getDb();
  const id = `${meetingId}-hi-${Date.now()}`;
  const shareToken = `${meetingId}-clip-${id}`;
  const [row] = await db.insert(schema.highlights).values({ id, meetingId, startMs, endMs, title, shareToken }).returning();
  return { id: row.id, meetingId: row.meetingId, startMs: row.startMs, endMs: row.endMs, title: row.title, shareToken: row.shareToken } satisfies Highlight;
}



import { and, eq, inArray } from "drizzle-orm";
import type { ActionItem } from "@/lib/types";
import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

export type Mention = { meetingId: string; meetingTitle: string; meetingDate: string; atMs: number; text: string; speaker: string };
export type Commitment = ActionItem & {
  meetingTitle: string;
  meetingDate: string;
  /** When it was said in the source meeting: the receipt. */
  atMs?: number;
  /** Later meetings where it came up again. */
  mentions: Mention[];
};

/** Every commitment in a workspace, with its receipt and later mentions. */
export async function listCommitments(userId: string): Promise<Commitment[]> {
  const db = getDb();
  const rows = await db
    .select({ item: schema.actionItems, meetingTitle: schema.meetings.title, meetingDate: schema.meetings.date, atMs: schema.transcriptSegments.startMs })
    .from(schema.actionItems)
    .innerJoin(schema.meetings, eq(schema.actionItems.meetingId, schema.meetings.id))
    .leftJoin(schema.transcriptSegments, eq(schema.actionItems.sourceSegmentId, schema.transcriptSegments.id))
    .where(eq(schema.meetings.userId, userId));
  if (rows.length === 0) return [];

  const mentionRows = await db
    .select({ actionItemId: schema.actionItemMentions.actionItemId, meetingId: schema.meetings.id, meetingTitle: schema.meetings.title, meetingDate: schema.meetings.date, atMs: schema.transcriptSegments.startMs, text: schema.transcriptSegments.text, speaker: schema.speakers.name })
    .from(schema.actionItemMentions)
    .innerJoin(schema.meetings, eq(schema.actionItemMentions.meetingId, schema.meetings.id))
    .innerJoin(schema.transcriptSegments, eq(schema.actionItemMentions.segmentId, schema.transcriptSegments.id))
    .innerJoin(schema.speakers, eq(schema.transcriptSegments.speakerId, schema.speakers.id))
    .where(and(eq(schema.meetings.userId, userId), inArray(schema.actionItemMentions.actionItemId, rows.map((row) => row.item.id))));

  return rows
    .map(({ item, meetingTitle, meetingDate, atMs }) => ({
      id: item.id,
      meetingId: item.meetingId,
      text: item.text,
      owner: item.owner,
      dueDate: item.dueDate.toISOString().slice(0, 10),
      completed: item.completed,
      status: item.completed ? ("Done" as const) : ("Open" as const),
      sourceSegmentId: item.sourceSegmentId ?? undefined,
      meetingTitle,
      meetingDate: meetingDate.toISOString(),
      atMs: atMs ?? undefined,
      mentions: mentionRows
        .filter((mention) => mention.actionItemId === item.id)
        .map((mention) => ({ meetingId: mention.meetingId, meetingTitle: mention.meetingTitle, meetingDate: mention.meetingDate.toISOString(), atMs: mention.atMs, text: mention.text, speaker: mention.speaker }))
    }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/**
 * Open commitments from earlier meetings whose owner is in this one.
 * This is what someone should chase before the meeting ends.
 */
export function carriedInto(commitments: Commitment[], meeting: { id: string; date: string; speakerNames: string[] }) {
  const people = new Set(meeting.speakerNames);
  return commitments.filter((item) => !item.completed && item.meetingId !== meeting.id && item.meetingDate < meeting.date && people.has(item.owner));
}

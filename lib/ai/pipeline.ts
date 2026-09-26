import { eq } from "drizzle-orm";
import { chatJson } from "@/lib/ai/groq";
import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { clock } from "@/lib/format";
import { download } from "@/lib/storage";
import type { Moment, SummaryContent } from "@/lib/types";

const TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const WHISPER_MAX_BYTES = 25 * 1024 * 1024;
const SPEAKER_COLORS = ["#D9572B", "#3B6FB6", "#2E7D6B", "#A2559C", "#B8871B", "#5E7F2E", "#C2466A", "#5B6AA8"];
// Meet captions trail speech by about a second; shift the speaker timeline back to match.
const CAPTION_LAG_MS = 1200;

export type Track = { objectPath: string; speakerName: string; contentType: string };
/** Who was speaking when, from the Meet extension. Times are wall-clock milliseconds. */
export type SpeakerTimeline = { startedAtMs: number; pauses: { startMs: number; endMs: number }[]; events: { t: number; name: string }[] };
type Line = { startMs: number; endMs: number; text: string; track: number; speaker: string };

async function transcribe(track: Track, index: number): Promise<Line[]> {
  const blob = await download(track.objectPath);
  if (blob.size === 0) return [];
  if (blob.size > WHISPER_MAX_BYTES) throw new Error("This recording is too long to transcribe in one piece (over ~90 minutes of audio).");
  const form = new FormData();
  form.append("file", new File([blob], track.objectPath.split("/").pop() ?? "audio.webm", { type: track.contentType }));
  form.append("model", "whisper-large-v3-turbo");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  form.append("timestamp_granularities[]", "word");
  form.append("temperature", "0");
  const response = await fetch(TRANSCRIBE_URL, { method: "POST", headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }, body: form });
  if (!response.ok) throw new Error(`Transcription failed (${response.status}).`);
  const data = await response.json();
  const wordStarts: number[] = (Array.isArray(data.words) ? data.words : []).map((word: { start?: number }) => Number(word.start ?? 0)).sort((a: number, b: number) => a - b);
  return (Array.isArray(data.segments) ? data.segments : [])
    // Whisper invents "Thank you." over silence; drop segments it thinks aren't speech.
    .filter((segment: { no_speech_prob?: number; avg_logprob?: number }) => !((segment.no_speech_prob ?? 0) > 0.6 && (segment.avg_logprob ?? 0) < -0.5))
    .map((segment: { start?: number; end?: number; text?: string }) => {
      const start = Number(segment.start ?? 0);
      const end = Number(segment.end ?? start);
      // Segment starts absorb the silence before them; the first word's timestamp is where speech begins.
      const firstWord = wordStarts.find((value) => value >= start && value < end);
      return { startMs: Math.round((firstWord ?? start) * 1000), endMs: Math.round(end * 1000), text: String(segment.text ?? "").trim(), track: index, speaker: track.speakerName };
    })
    .filter((line: Line) => line.text.length > 1);
}

const words = (text: string) => new Set(text.toLowerCase().match(/[a-z0-9']+/g) ?? []);
function similar(a: string, b: string) {
  const left = words(a);
  const right = words(b);
  const shared = [...left].filter((word) => right.has(word)).length;
  return shared / Math.max(1, Math.min(left.size, right.size));
}

/** Without headphones the mic hears the call too; drop mic lines that echo a system-audio line. */
function merge(tracks: Line[][]) {
  const [mine = [], ...others] = tracks;
  const theirs = others.flat();
  const kept = tracks.length > 1
    ? mine.filter((line) => !theirs.some((other) => other.startMs < line.endMs + 1500 && line.startMs < other.endMs + 1500 && similar(line.text, other.text) > 0.6))
    : mine;
  return [...kept, ...theirs].sort((a, b) => a.startMs - b.startMs);
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Deadlines as people say them ("Thursday", "tomorrow") resolved in code; models get weekday arithmetic wrong. */
export function resolveDue(said: unknown, now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const plus = (days: number) => new Date(today.getTime() + days * 86_400_000).toISOString().slice(0, 10);
  const text = typeof said === "string" ? said.toLowerCase() : "";
  if (/\btoday\b|end of (the )?day|\beod\b/.test(text)) return plus(0);
  if (/\btomorrow\b/.test(text)) return plus(1);
  const weekday = WEEKDAYS.findIndex((day) => text.includes(day));
  if (weekday !== -1) return plus(((weekday - today.getUTCDay() + 7) % 7 || 7) + (/next week/.test(text) ? 7 : 0));
  if (/next week/.test(text)) return plus(7);
  if (/end of (the )?week/.test(text)) return plus(((5 - today.getUTCDay() + 7) % 7) || 7);
  const parsed = Date.parse(`${said} ${today.getUTCFullYear()} UTC`);
  if (text && !Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return plus(7);
}

type Analysis = { headline: string; sections: SummaryContent["sections"]; chapters: { title: string; startMs: number }[]; commitments: { text: string; owner: string; due: string; lineIndex?: number }[] };

async function analyse(lines: Line[], you: string, title: string): Promise<Analysis> {
  const numbered = lines.map((line, index) => `L${index + 1} [${clock(line.startMs)}] ${line.speaker}: ${line.text}`).join("\n").slice(0, 60_000);
  // Weekday included so "by Thursday" resolves to the right date.
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  const parsed = (await chatJson([
    { role: "system", content: `You turn meeting transcripts into notes that cite their sources. Today is ${today}. Return JSON:
{"headline": string, "sections": [{"title": "Decisions" | "Key points" | "Quotes", "items": [{"text": string, "line": number}]}], "chapters": [{"title": string, "line": number}], "commitments": [{"text": string, "owner": string, "due": string | null, "line": number}]}
- "line" is the number of the transcript line (L12 means 12) that supports the item.
- headline: one sentence with the outcome.
- chapters: short topic titles in order, roughly one per 5-10 minutes of conversation (1 for a short call, never more than 8); the first starts at line 1.
- commitments: every concrete promise a person made ("I'll send…", "I will fix… by Thursday", "I'll tell the team"), including small ones. text is a short task in the imperative ("Fix the PDF layout for long vendor names"), not a quote. owner is the person's name as said in the call; a promise a speaker makes about themselves is owned by that speaker's name ("${you}" for lines by "${you}"). due is the deadline exactly as said ("Thursday", "today", "tomorrow", "next week", "October 3"), or null if none was said. Skip sign-offs like "talk Thursday".
- Quotes are verbatim. Leave anything out rather than invent it.` },
    { role: "user", content: `Meeting: ${title}\n\n${numbered}` }
  ])) as { headline?: unknown; sections?: unknown; chapters?: unknown; commitments?: unknown };
  const lineAt = (value: unknown) => (typeof value === "number" && value >= 1 && value <= lines.length ? value - 1 : undefined);
  const moment = (item: { text?: unknown; line?: unknown }): Moment => {
    const index = lineAt(item.line);
    return index === undefined ? { text: String(item.text) } : { text: String(item.text), atMs: lines[index].startMs, speaker: lines[index].speaker };
  };
  return {
    headline: typeof parsed.headline === "string" ? parsed.headline : "Recording transcribed.",
    sections: (Array.isArray(parsed.sections) ? parsed.sections : [])
      .filter((section: { title?: unknown; items?: unknown }) => typeof section.title === "string" && Array.isArray(section.items))
      .map((section: { title: string; items: { text?: unknown; line?: unknown }[] }) => ({ title: section.title, items: section.items.filter((item) => typeof item?.text === "string").map(moment) }))
      .filter((section: { items: unknown[] }) => section.items.length > 0),
    chapters: (Array.isArray(parsed.chapters) ? parsed.chapters : [])
      .map((chapter: { title?: unknown; line?: unknown }) => ({ title: String(chapter.title ?? "").slice(0, 80), index: lineAt(chapter.line) }))
      .filter((chapter: { title: string; index?: number }): chapter is { title: string; index: number } => Boolean(chapter.title) && chapter.index !== undefined)
      .map((chapter: { title: string; index: number }) => ({ title: chapter.title, startMs: lines[chapter.index].startMs })),
    commitments: (Array.isArray(parsed.commitments) ? parsed.commitments : [])
      .filter((item: { text?: unknown; owner?: unknown }) => typeof item.text === "string" && typeof item.owner === "string")
      .map((item: { text: string; owner: string; due?: unknown; line?: unknown }) => ({ text: item.text.slice(0, 300), owner: item.owner.slice(0, 80), due: resolveDue(item.due), lineIndex: lineAt(item.line) }))
  };
}

/**
 * Turns uploaded audio into a finished meeting: transcript with speakers, recap,
 * chapters and commitments. Runs after the upload request has returned.
 */
/** Maps a wall-clock time to a position in the recording, skipping time spent paused. */
function toRecordingMs(t: number, timeline: SpeakerTimeline) {
  let ms = t - timeline.startedAtMs;
  for (const pause of timeline.pauses) {
    if (t >= pause.endMs) ms -= pause.endMs - pause.startMs;
    else if (t > pause.startMs) ms -= t - pause.startMs;
  }
  return ms;
}

/** Relabels "others" lines with whoever Meet showed as speaking during most of the line. */
export function attributeSpeakers(lines: Line[], othersTrack: number, timeline: SpeakerTimeline, you: string) {
  const turns = timeline.events
    .filter((event) => event.name && event.name !== "You" && event.name !== you)
    .map((event) => ({ name: event.name, startMs: toRecordingMs(event.t, timeline) - CAPTION_LAG_MS }))
    .sort((a, b) => a.startMs - b.startMs)
    .map((turn, index, all) => ({ ...turn, endMs: Math.min(all[index + 1]?.startMs ?? Infinity, turn.startMs + 30_000) }));
  if (turns.length === 0) return lines;
  return lines.map((line) => {
    if (line.track !== othersTrack) return line;
    const overlap = new Map<string, number>();
    for (const turn of turns) {
      const shared = Math.min(line.endMs, turn.endMs) - Math.max(line.startMs, turn.startMs);
      if (shared > 0) overlap.set(turn.name, (overlap.get(turn.name) ?? 0) + shared);
    }
    const [best] = [...overlap.entries()].sort((a, b) => b[1] - a[1]);
    return best && best[1] >= 0.3 * Math.max(1, line.endMs - line.startMs) ? { ...line, speaker: best[0] } : line;
  });
}

export async function processRecording(meetingId: string, tracks: Track[], title: string, timeline?: SpeakerTimeline) {
  const db = getDb();
  try {
    if (!process.env.GROQ_API_KEY) throw new Error("Transcription isn't configured on this deployment.");
    const transcribed = await Promise.all(tracks.map(transcribe));
    const you = tracks[0].speakerName;
    const merged = merge(transcribed);
    const lines = timeline && tracks.length > 1 ? attributeSpeakers(merged, 1, timeline, you) : merged;
    // One speaker per distinct name, in order of first appearance.
    const names = [...new Set([...lines.map((line) => line.speaker), ...(lines.length ? [] : tracks.map((track) => track.speakerName))])];
    const durationMs = Math.max(1000, ...lines.map((line) => line.endMs));

    const speakerIds = new Map(names.map((name, index) => [name, `${meetingId}-sp-${index + 1}`]));
    const segments = lines.map((line, index) => ({ id: `${meetingId}-seg-${index + 1}`, meetingId, speakerId: speakerIds.get(line.speaker)!, startMs: line.startMs, endMs: Math.max(line.endMs, line.startMs + 500), text: line.text, chapterId: null as string | null }));
    const analysis = lines.length ? await analyse(lines, you, title) : { headline: "No speech was detected in this recording.", sections: [], chapters: [], commitments: [] };

    const chapters = analysis.chapters.sort((a, b) => a.startMs - b.startMs).map((chapter, index, all) => ({ id: `${meetingId}-ch-${index + 1}`, meetingId, title: chapter.title, startMs: index === 0 ? 0 : chapter.startMs, endMs: all[index + 1]?.startMs ?? durationMs, order: index + 1 }));
    for (const segment of segments) segment.chapterId = [...chapters].reverse().find((chapter) => chapter.startMs <= segment.startMs)?.id ?? null;

    await db.transaction(async (tx) => {
      await tx.insert(schema.speakers).values(names.map((name, index) => ({ id: speakerIds.get(name)!, meetingId, name, avatarUrl: "", color: SPEAKER_COLORS[index % SPEAKER_COLORS.length] })));
      await tx.insert(schema.meetingAttendees).values([...speakerIds.values()].map((speakerId) => ({ meetingId, speakerId })));
      if (chapters.length) await tx.insert(schema.chapters).values(chapters);
      if (segments.length) await tx.insert(schema.transcriptSegments).values(segments);
      await tx.insert(schema.summaries).values({ id: `${meetingId}-general`, meetingId, template: "general", contentJson: { headline: analysis.headline, sections: analysis.sections, bullets: [], decisions: [], keyQuotes: [] } satisfies SummaryContent });
      if (analysis.commitments.length) await tx.insert(schema.actionItems).values(analysis.commitments.map((item, index) => ({ id: `${meetingId}-act-${index + 1}`, meetingId, text: item.text, owner: item.owner, dueDate: new Date(`${item.due}T00:00:00Z`), completed: false, sourceSegmentId: item.lineIndex === undefined ? null : segments[item.lineIndex].id })));
      await tx.update(schema.meetings).set({ status: "ready", durationSeconds: Math.round(durationMs / 1000) }).where(eq(schema.meetings.id, meetingId));
    });
  } catch (error) {
    console.error(`[pipeline] ${meetingId}:`, error);
    await db.update(schema.meetings).set({ status: "failed" }).where(eq(schema.meetings.id, meetingId));
  }
}

import { chatJson } from "@/lib/ai/groq";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { clock } from "@/lib/format";
import type { Meeting, Moment, SummaryContent, SummaryTemplate } from "@/lib/types";

const SECTIONS: Record<SummaryTemplate, string[]> = {
  general: ["Decisions", "Key points", "Quotes"],
  sales: ["Pain", "Success criteria", "Buying signals", "Objections & blockers", "Next steps"],
  interview: ["Strengths", "Concerns", "How they'd handle our problems", "Recommendation"],
  standup: ["Done", "Next", "Blockers", "Risks"]
};

/** Writes a template-specific recap from the transcript. Every item cites the line it came from. */
export async function generateTemplateSummary(meeting: Meeting, template: SummaryTemplate): Promise<SummaryContent> {
  if (!process.env.GROQ_API_KEY) throw new Error("AI recaps aren't configured on this deployment.");
  const speakers = new Map(meeting.speakers.map((speaker) => [speaker.id, speaker.name]));
  // Numbered lines let the model cite exactly; timestamps alone drift by a line or two.
  const transcript = meeting.transcript.map((segment, index) => `L${index + 1} [${clock(segment.startMs)}] ${speakers.get(segment.speakerId)}: ${segment.text}`).join("\n").slice(0, 24_000);

  const parsed = (await chatJson([
    { role: "system", content: `You write meeting recaps that cite their sources. Return JSON: {"headline": string, "sections": [{"title": string, "items": [{"text": string, "line": number}]}]}. Use exactly these section titles, in order: ${SECTIONS[template].join(", ")}. Each item is one short sentence, and "line" is the number of the transcript line (L12 means 12) that best supports it. Leave a section empty rather than inventing anything. The headline is one sentence stating the outcome.` },
    { role: "user", content: `Meeting: ${meeting.title}\n\n${transcript}` }
  ])) as { headline?: unknown; sections?: unknown };
  if (typeof parsed.headline !== "string" || !Array.isArray(parsed.sections)) throw new Error("The AI provider returned an unexpected format.");

  const cite = (line: unknown) => {
    const segment = typeof line === "number" ? meeting.transcript[line - 1] : undefined;
    return segment ? { atMs: segment.startMs, speaker: speakers.get(segment.speakerId) } : {};
  };
  return {
    headline: parsed.headline,
    sections: parsed.sections
      .filter((section: { title?: unknown; items?: unknown }) => typeof section.title === "string" && Array.isArray(section.items))
      .map((section: { title: string; items: { text?: unknown; line?: unknown }[] }) => ({
        title: section.title,
        items: section.items.filter((item) => typeof item?.text === "string").map((item): Moment => ({ text: String(item.text), ...cite(Number(item.line)) }))
      }))
      .filter((section: { items: unknown[] }) => section.items.length > 0),
    bullets: [],
    decisions: [],
    keyQuotes: []
  };
}

export async function saveSummary(meetingId: string, template: SummaryTemplate, content: SummaryContent) {
  const db = getDb();
  await db.delete(schema.summaries).where(and(eq(schema.summaries.meetingId, meetingId), eq(schema.summaries.template, template)));
  await db.insert(schema.summaries).values({ id: `${meetingId}-${template}`, meetingId, template, contentJson: content });
}

import { GROQ_CHAT_MODEL, GROQ_CHAT_URL } from "@/lib/ai/groq";
import { findSegments } from "@/lib/db/queries";
import { clock } from "@/lib/format";

export type Citation = { meetingId: string; segmentId: string; startMs: number; label: string };
export type AskAnswer = { answer: string; citations: Citation[] };

const STOPWORDS = new Set("a an and are as at be but by did do does for from had has have how i in is it its me my of on or our so that the their them then there they this to was we were what when where which who why will with you your about any did said say".split(" "));

function keywordsOf(question: string) {
  const words = question.toLowerCase().match(/[a-z0-9']{3,}/g) ?? [];
  return [...new Set(words.filter((word) => !STOPWORDS.has(word)))].slice(0, 8);
}

async function groqAnswer(question: string, context: string): Promise<string | null> {
  if (!process.env.GROQ_API_KEY) return null;
  const response = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: GROQ_CHAT_MODEL,
      temperature: 0.1,
      messages: [
        { role: "system", content: "Answer the question using only the meeting excerpts. Be direct, at most 3 sentences. Name who said it. If the excerpts do not answer it, say so." },
        { role: "user", content: `Question: ${question}\n\nExcerpts:\n${context}` }
      ]
    })
  }).catch(() => null);
  if (!response?.ok) return null;
  const data = await response.json().catch(() => null);
  const text = data?.choices?.[0]?.message?.content;
  return typeof text === "string" ? text.trim() : null;
}

/** Retrieves matching transcript moments from the database, then answers from them (LLM when configured, extractive otherwise). */
export async function askMeetings(question: string, userId: string, meetingId?: string): Promise<AskAnswer> {
  const keywords = keywordsOf(question);
  if (keywords.length === 0) return { answer: "Ask about a topic, a person, or a decision.", citations: [] };

  const rows = await findSegments(keywords, userId, meetingId);
  const ranked = rows
    .map((row) => ({ row, score: keywords.filter((word) => row.text.toLowerCase().includes(word)).length }))
    .sort((a, b) => b.score - a.score || a.row.startMs - b.row.startMs)
    .slice(0, 5)
    .map(({ row }) => row);

  if (ranked.length === 0) return { answer: "Nothing in these meetings matches that. Try a different phrase or a person's name.", citations: [] };

  const citations = ranked.map((row) => ({ meetingId: row.meetingId, segmentId: row.id, startMs: row.startMs, label: `${meetingId ? "" : `${row.meetingTitle} · `}${clock(row.startMs)}` }));
  const context = ranked.map((row) => `[${row.meetingTitle} ${clock(row.startMs)}] ${row.speaker}: ${row.text}`).join("\n");
  const generated = await groqAnswer(question, context);
  const top = ranked[0];
  return { answer: generated ?? `${top.speaker} in ${top.meetingTitle} at ${clock(top.startMs)}: “${top.text}”`, citations };
}

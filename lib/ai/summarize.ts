export type TranscribedSegment = { startMs: number; endMs: number; text: string };
export type GeneratedMeetingContent = {
  headline: string;
  bullets: string[];
  decisions: string[];
  keyQuotes: string[];
  actionItems: { text: string; owner: string }[];
};

const GROQ_TRANSCRIPTIONS_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function transcribeRecording(file: File): Promise<TranscribedSegment[] | null> {
  if (!process.env.GROQ_API_KEY) return null;

  const form = new FormData();
  form.append("file", file, file.name || "recording.webm");
  form.append("model", "whisper-large-v3-turbo");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  form.append("temperature", "0");

  const response = await fetch(GROQ_TRANSCRIPTIONS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: form
  });

  if (!response.ok) throw new Error(`Groq transcription failed with status ${response.status}`);
  const data = await response.json();
  const segments = Array.isArray(data.segments) ? data.segments : [];

  if (segments.length === 0 && typeof data.text === "string" && data.text.trim()) {
    return [{ startMs: 0, endMs: 1000, text: data.text.trim() }];
  }

  return segments
    .map((segment: { start?: number; end?: number; text?: string }) => ({
      startMs: Math.max(0, Math.round(Number(segment.start ?? 0) * 1000)),
      endMs: Math.max(1000, Math.round(Number(segment.end ?? 1) * 1000)),
      text: String(segment.text ?? "").trim()
    }))
    .filter((segment: TranscribedSegment) => segment.text.length > 0);
}

export function fallbackMeetingContent(transcriptText: string, hasTranscript: boolean): GeneratedMeetingContent {
  const text = transcriptText.trim();
  return {
    headline: hasTranscript ? "Recording transcribed and ready for review." : "Recording uploaded successfully.",
    bullets: hasTranscript ? [text.slice(0, 220) || "Transcript is available in the meeting workspace."] : ["Automatic transcription requires GROQ_API_KEY.", "The uploaded recording is still playable from the meeting detail page."],
    decisions: hasTranscript ? ["Review the transcript for decisions and follow-up context."] : ["Enable GROQ_API_KEY to generate timestamped transcript segments."],
    keyQuotes: hasTranscript && text ? [text.slice(0, 180)] : ["Recording uploaded successfully. Automatic transcription requires GROQ_API_KEY."],
    actionItems: []
  };
}

export async function summarizeTranscript(transcriptText: string): Promise<GeneratedMeetingContent> {
  const fallback = fallbackMeetingContent(transcriptText, true);
  if (!process.env.GROQ_API_KEY || !transcriptText.trim()) return fallback;

  const response = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return strict JSON with headline, bullets, decisions, keyQuotes, actionItems. actionItems must be an array of {text, owner}; use owner only when explicitly stated." },
        { role: "user", content: transcriptText.slice(0, 12000) }
      ]
    })
  });

  if (!response.ok) return fallback;
  const data = await response.json().catch(() => null);
  const raw = data?.choices?.[0]?.message?.content;
  if (typeof raw !== "string") return fallback;

  try {
    const parsed = JSON.parse(raw);
    return {
      headline: typeof parsed.headline === "string" ? parsed.headline.slice(0, 180) : fallback.headline,
      bullets: Array.isArray(parsed.bullets) ? parsed.bullets.slice(0, 5).map(String) : fallback.bullets,
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions.slice(0, 5).map(String) : fallback.decisions,
      keyQuotes: Array.isArray(parsed.keyQuotes) ? parsed.keyQuotes.slice(0, 4).map(String) : fallback.keyQuotes,
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.slice(0, 6).map((item: { text?: string; owner?: string }) => ({ text: String(item.text ?? "").trim(), owner: String(item.owner ?? "").trim() })).filter((item: { text: string; owner: string }) => item.text && item.owner) : []
    };
  } catch {
    return fallback;
  }
}

export async function summarizeMeeting() { return { live: Boolean(process.env.GROQ_API_KEY), reason: process.env.GROQ_API_KEY ? "Live summarization can be enabled here." : "Seeded summaries are the source of truth unless GROQ_API_KEY is enabled." }; }

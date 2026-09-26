export const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
// llama-3.3-70b-versatile was retired; keep the model in one place.
export const GROQ_CHAT_MODEL = process.env.GROQ_CHAT_MODEL ?? "openai/gpt-oss-120b";

type Message = { role: "system" | "user"; content: string };

async function complete(messages: Message[], jsonMode: boolean) {
  const response = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({ model: GROQ_CHAT_MODEL, temperature: 0.2, messages, ...(jsonMode ? { response_format: { type: "json_object" } } : {}) })
  });
  if (!response.ok) return { error: `${response.status}: ${(await response.text().catch(() => "")).slice(0, 200)}` };
  const data = await response.json();
  return { text: String(data?.choices?.[0]?.message?.content ?? "") };
}

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON in the model's reply.");
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * Asks for a JSON object. JSON mode occasionally rejects a generation
 * (json_validate_failed), so retry once, then fall back to plain text and extract it.
 */
export async function chatJson(messages: Message[]): Promise<Record<string, unknown>> {
  let lastError = "";
  for (const jsonMode of [true, true, false]) {
    const result = await complete(messages, jsonMode);
    if (result.error) { lastError = result.error; if (!result.error.startsWith("400")) break; continue; }
    try { return extractJson(result.text!); } catch (error) { lastError = error instanceof Error ? error.message : "Bad JSON."; }
  }
  throw new Error(`The AI provider couldn't produce notes (${lastError}).`);
}

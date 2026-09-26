"use client";
import Link from "next/link";
import { Play, Sparkles } from "lucide-react";
import { useState } from "react";

type Answer = { answer: string; citations: { meetingId: string; segmentId: string; startMs: number; label: string }[] };
const SUGGESTIONS = ["Where are we on the SOC 2 report?", "Why does import come before SSO?", "What did Acme say about late fees?"];

export function AskWorkspace() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);

  const ask = async (text: string) => {
    if (!text.trim()) return;
    setQuestion(text);
    setLoading(true);
    const response = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: text }) }).catch(() => null);
    setAnswer(response?.ok ? await response.json() : { answer: "Couldn't reach the meeting index. Try again.", citations: [] });
    setLoading(false);
  };

  return <section className="card" style={{ marginBottom: 28 }} aria-labelledby="ask-title">
    <h2 id="ask-title" style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}><Sparkles size={15}/>Ask across every meeting</h2>
    <form className="ask-form" onSubmit={(event) => { event.preventDefault(); void ask(question); }}>
      <input className="input" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask a question in plain words" aria-label="Ask across meetings"/>
      <button className="button primary" type="submit" disabled={loading || !question.trim()}>{loading ? "Asking…" : "Ask"}</button>
    </form>
    {!answer && <div className="suggestions">{SUGGESTIONS.map((text) => <button key={text} type="button" onClick={() => ask(text)}>{text}</button>)}</div>}
    {answer && <div className="ask-answer" aria-live="polite">
      <p>{answer.answer}</p>
      {answer.citations.length > 0 && <div className="toolbar">{answer.citations.map((citation) => <Link className="stamp" key={citation.segmentId} href={`/meetings/${citation.meetingId}?t=${citation.startMs}`}><Play size={11}/>{citation.label}</Link>)}</div>}
    </div>}
  </section>;
}

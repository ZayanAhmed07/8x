"use client";
import { useState } from "react";

type Citation = { meetingId: string; segmentId: string; startMs: number; label: string };
export function AskPanel() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(false);
  const ask = async () => {
    setLoading(true);
    const response = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
    const data = await response.json();
    setAnswer(data.answer ?? "");
    setCitations(data.citations ?? []);
    setLoading(false);
  };
  return <section className="card ask-card"><h2>Ask across meetings</h2><div className="toolbar"><input className="input" style={{flex:1}} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What did we decide about pricing?"/><button className="button primary" onClick={ask} disabled={loading}>{loading ? "Asking" : "Ask"}</button></div>{answer && <p>{answer}</p>}<div className="toolbar">{citations.map((citation) => <a className="badge" key={citation.segmentId} href={`/meetings/${citation.meetingId}?t=${citation.startMs}`}>{citation.label}</a>)}</div></section>;
}

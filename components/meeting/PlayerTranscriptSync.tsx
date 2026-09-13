"use client";
import type { Meeting } from "@/lib/data";
import { useMemo, useRef, useState } from "react";

function time(ms: number) { const seconds = Math.floor(ms / 1000); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }

export function PlayerTranscriptSync({ meeting }: { meeting: Meeting }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [query, setQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const activeIndex = Math.max(0, meeting.transcript.findIndex((s) => currentMs >= s.startMs && currentMs <= s.endMs));
  const filtered = useMemo(() => meeting.transcript.filter((s) => s.text.toLowerCase().includes(query.toLowerCase())), [meeting.transcript, query]);
  const windowed = query ? filtered : meeting.transcript.slice(Math.max(0, activeIndex - 8), activeIndex + 16);
  const seek = (ms: number) => { if (videoRef.current) videoRef.current.currentTime = ms / 1000; setCurrentMs(ms); };
  return <div className="workspace"><section><video ref={videoRef} className="video" controls src={meeting.videoUrl} onTimeUpdate={(e) => setCurrentMs(e.currentTarget.currentTime * 1000)} /><div className="toolbar" style={{marginTop:12}}><label className="button"><input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} /> Auto-scroll</label><span className="badge">{time(currentMs)}</span></div></section><section className="card"><div className="toolbar" style={{justifyContent:"space-between", marginBottom:12}}><h2 style={{margin:0}}>Transcript</h2><input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search transcript" /></div><div style={{maxHeight:620, overflow:"auto"}}>{windowed.map((seg) => { const speaker = meeting.speakers.find((s) => s.id === seg.speakerId); const active = currentMs >= seg.startMs && currentMs <= seg.endMs; return <button key={seg.id} className={`segment ${active ? "active" : ""}`} onClick={() => seek(seg.startMs)} style={{width:"100%", textAlign:"left"}}><strong style={{color:speaker?.color}}>{speaker?.name}<br/><span className="muted">{time(seg.startMs)}</span></strong><span>{seg.text}</span></button>; })}</div><p className="muted">Showing {windowed.length} of {meeting.transcript.length} segments{autoScroll ? " with active-window tracking" : ""}.</p></section></div>;
}

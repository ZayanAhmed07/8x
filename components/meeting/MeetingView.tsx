"use client";
import { Link2, Loader2, Play, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { CommitmentItem } from "@/components/commitments/CommitmentItem";
import { SpeakerLanes } from "@/components/meeting/SpeakerLanes";
import { Transcript } from "@/components/meeting/Transcript";
import { usePlayback } from "@/components/meeting/usePlayback";
import type { Commitment } from "@/lib/db/commitments";
import { asMoment, clock, summarySections } from "@/lib/format";
import type { Highlight, Meeting, SummaryTemplate } from "@/lib/types";

type Tab = "recap" | "commitments" | "clips" | "ask";
const TEMPLATES: SummaryTemplate[] = ["general", "sales", "interview", "standup"];
const TEMPLATE_LABEL: Record<SummaryTemplate, string> = { general: "General", sales: "Sales call", interview: "Interview", standup: "Standup" };

type Props = {
  meeting: Meeting;
  commitments: Commitment[];
  carried: Commitment[];
  colors: Record<string, string>;
  initialMs?: number;
  focusActionId?: string;
  aiEnabled: boolean;
};

export function MeetingView({ meeting, commitments, carried, colors, initialMs = 0, focusActionId, aiEnabled }: Props) {
  const router = useRouter();
  const mediaRef = useRef<HTMLMediaElement>(null);
  const hasVideo = Boolean(meeting.videoUrl);
  const durationMs = Math.max(meeting.durationSeconds * 1000, meeting.transcript.at(-1)?.endMs ?? 0, 1000);
  const playback = usePlayback(durationMs, mediaRef, hasVideo, initialMs);
  const [tab, setTab] = useState<Tab>(focusActionId ? "commitments" : "recap");
  const [toast, setToast] = useState("");
  const [focusClip, setFocusClip] = useState<Highlight | null>(null);

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2600); };
  const openCount = commitments.filter((item) => !item.completed).length;
  const lateCarried = carried.length;

  useEffect(() => {
    if (focusActionId) document.getElementById(`action-${focusActionId}`)?.scrollIntoView({ block: "center" });
  }, [focusActionId]);

  // Space plays and pauses; J and L skip ten seconds.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, button, [contenteditable]") || event.metaKey || event.ctrlKey) return;
      if (event.key === " ") { event.preventDefault(); playback.toggle(); }
      if (event.key === "j") playback.seek(playback.currentMs - 10_000);
      if (event.key === "l") playback.seek(playback.currentMs + 10_000);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playback]);

  const seekAndPlay = (ms: number) => { playback.seek(ms); if (!playback.playing) playback.play(); };

  const copy = async (path: string, message: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}${path}`).catch(() => undefined);
    notify(message);
  };

  const createClip = async (range: { startMs: number; endMs: number; title: string }) => {
    const response = await fetch(`/api/meetings/${meeting.id}/highlights`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(range) }).catch(() => null);
    if (!response?.ok) { notify("Couldn't save that clip."); return false; }
    const { highlight } = await response.json();
    await copy(`/share/${highlight.shareToken}`, "Clip saved. Share link copied.");
    setTab("clips");
    router.refresh();
    return true;
  };

  // New recordings finish processing in the background; check back until they do.
  useEffect(() => {
    if (meeting.status !== "processing") return;
    const id = window.setInterval(() => router.refresh(), 5000);
    return () => window.clearInterval(id);
  }, [meeting.status, router]);

  if (meeting.status !== "ready") {
    return <div className="processing-state">
      {meeting.status === "processing" ? <span className="spinner" aria-hidden="true"/> : null}
      <h2>{meeting.status === "processing" ? "Transcribing this meeting" : "This recording couldn't be processed"}</h2>
      <p className="muted" style={{ maxWidth: 440 }}>{meeting.status === "processing" ? "The recap, commitments and speaker timeline appear here when it's done. Recordings usually finish in a few minutes." : "Try uploading the recording again."}</p>
    </div>;
  }

  return <>
    <SpeakerLanes meeting={meeting} durationMs={durationMs} currentMs={playback.currentMs} playing={playback.playing} rate={playback.rate} onSeek={playback.seek} onToggle={playback.toggle} onRate={playback.setRate}/>
    <div className="meeting-body">
      <section className="doc" aria-label="Meeting notes">
        <div className="tabs" role="tablist">
          <button role="tab" type="button" aria-selected={tab === "recap"} onClick={() => setTab("recap")}>Recap</button>
          <button role="tab" type="button" aria-selected={tab === "commitments"} onClick={() => setTab("commitments")}>Commitments <span className={`count${lateCarried ? " hot" : ""}`}>{openCount + lateCarried}</span></button>
          <button role="tab" type="button" aria-selected={tab === "clips"} onClick={() => setTab("clips")}>Clips <span className="count">{meeting.highlights.length}</span></button>
          <button role="tab" type="button" aria-selected={tab === "ask"} onClick={() => setTab("ask")}><Sparkles size={14}/>Ask</button>
        </div>
        <div className="doc-body" role="tabpanel">
          {tab === "recap" && <Recap meeting={meeting} onSeek={seekAndPlay} aiEnabled={aiEnabled} onGenerated={() => router.refresh()}/>}
          {tab === "commitments" && <Commitments meeting={meeting} commitments={commitments} carried={carried} colors={colors} onSeek={seekAndPlay} focusActionId={focusActionId}/>}
          {tab === "clips" && <Clips highlights={meeting.highlights} onPlay={(clip) => { setFocusClip(clip); playback.playRange(clip.startMs, clip.endMs); }} onCopy={(clip) => copy(`/share/${clip.shareToken}`, "Clip link copied.")}/>}
          {tab === "ask" && <Ask meeting={meeting} onSeek={seekAndPlay}/>}
        </div>
      </section>

      <Transcript meeting={meeting} currentMs={playback.currentMs} playing={playback.playing} onSeek={playback.seek} onCreateClip={createClip} canClip focusRange={focusClip}>
        {hasVideo && (meeting.mediaKind === "audio"
          ? <audio className="evidence-audio" ref={mediaRef as RefObject<HTMLAudioElement>} src={meeting.videoUrl} controls preload="metadata" {...playback.videoProps}/>
          : <video ref={mediaRef as RefObject<HTMLVideoElement>} src={meeting.videoUrl} controls playsInline {...playback.videoProps}/>)}
      </Transcript>
    </div>
    {meeting.shareToken && <div className="toolbar" style={{ marginTop: 16 }}>
      <button className="button small ghost" type="button" onClick={() => copy(`/share/${meeting.shareToken}`, "Recap link copied. Anyone with it can read the recap.")}><Link2 size={14}/>Copy recap link for someone who wasn't there</button>
    </div>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </>;
}

function Recap({ meeting, onSeek, aiEnabled, onGenerated }: { meeting: Meeting; onSeek: (ms: number) => void; aiEnabled: boolean; onGenerated: () => void }) {
  const available = TEMPLATES.filter((template) => meeting.summaries.some((summary) => summary.template === template));
  const [template, setTemplate] = useState<SummaryTemplate>(available[0] ?? "general");
  const [generating, setGenerating] = useState<SummaryTemplate | null>(null);
  const [error, setError] = useState("");
  const summary = meeting.summaries.find((item) => item.template === template) ?? meeting.summaries[0];

  const generate = async (next: SummaryTemplate) => {
    setGenerating(next);
    setError("");
    const response = await fetch(`/api/meetings/${meeting.id}/summary`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template: next }) }).catch(() => null);
    const data = await response?.json().catch(() => null);
    setGenerating(null);
    if (!response?.ok) { setError(data?.error ?? "Couldn't generate that recap."); return; }
    setTemplate(next);
    onGenerated();
  };

  if (!summary) return <p className="muted">No recap yet.</p>;
  const sections = summarySections(summary.content);
  return <>
    <div className="template-switch" aria-label="Recap template">
      {available.map((value) => <button key={value} type="button" aria-pressed={value === summary.template} onClick={() => setTemplate(value)}>{TEMPLATE_LABEL[value]}</button>)}
      {aiEnabled && TEMPLATES.filter((value) => !available.includes(value)).map((value) => <button key={value} type="button" className="generate" onClick={() => generate(value)} disabled={generating !== null} title={`Write a ${TEMPLATE_LABEL[value].toLowerCase()} recap from the transcript`}>{generating === value ? <Loader2 size={12} className="spin"/> : "+"} {TEMPLATE_LABEL[value]}</button>)}
    </div>
    {error && <p className="form-message" role="alert" style={{ marginBottom: 16 }}>{error}</p>}
    <p className="headline">{summary.content.headline}</p>
    {sections.map((section) => {
      const kind = /decision/i.test(section.title) ? " decisions" : /quote/i.test(section.title) ? " quotes" : "";
      return <div className="doc-section" key={section.title}>
        <h3>{section.title}</h3>
        <ul className={`moments${kind}`}>
          {section.items.map((raw, index) => {
            const item = asMoment(raw);
            return <li key={index}>
              <p>{kind === " quotes" ? `“${item.text}”` : item.text}{kind === " quotes" && item.speaker && <span className="who">{item.speaker}</span>}</p>
              {item.atMs !== undefined ? <button className="stamp" type="button" onClick={() => onSeek(item.atMs!)} title={item.speaker ? `Play ${item.speaker} at ${clock(item.atMs)}` : "Play this moment"}><Play size={11}/>{clock(item.atMs)}</button> : <span/>}
            </li>;
          })}
        </ul>
      </div>;
    })}
  </>;
}

function Commitments({ meeting, commitments, carried, colors, onSeek, focusActionId }: { meeting: Meeting; commitments: Commitment[]; carried: Commitment[]; colors: Record<string, string>; onSeek: (ms: number) => void; focusActionId?: string }) {
  const sorted = [...commitments].sort((a, b) => Number(a.completed) - Number(b.completed) || a.dueDate.localeCompare(b.dueDate));
  return <>
    {sorted.length === 0 ? <p className="muted">Nobody took on anything in this meeting.</p> : <>
      <div className="doc-section" style={{ marginTop: 0 }}><h3>Agreed in this meeting</h3></div>
      <ul className="commitments">{sorted.map((item) => <CommitmentItem key={item.id} item={item} color={colors[item.owner]} meetingId={meeting.id} onSeek={onSeek} flash={item.id === focusActionId}/>)}</ul>
    </>}
    {carried.length > 0 && <div className="carried">
      <h3>Still open from earlier meetings</h3>
      <p>These people were in this meeting and still owe something from before.</p>
      <ul className="commitments">{carried.map((item) => <CommitmentItem key={item.id} item={item} color={colors[item.owner]} meetingId={meeting.id} onSeek={onSeek} flash={item.id === focusActionId}/>)}</ul>
    </div>}
  </>;
}

function Clips({ highlights, onPlay, onCopy }: { highlights: Highlight[]; onPlay: (clip: Highlight) => void; onCopy: (clip: Highlight) => void }) {
  if (highlights.length === 0) return <p className="muted">No clips yet. Select a passage in the transcript to make one.</p>;
  return <ul className="clip-list">
    {highlights.map((clip) => <li key={clip.id}>
      <div><div className="clip-title">{clip.title}</div><span className="faint mono" style={{ fontSize: 12.5 }}>{clock(clip.startMs)}–{clock(clip.endMs)} · {Math.max(1, Math.round((clip.endMs - clip.startMs) / 1000))}s</span></div>
      <div className="clip-actions">
        <button className="button small" type="button" onClick={() => onPlay(clip)}><Play size={13}/>Play</button>
        <button className="button small" type="button" onClick={() => onCopy(clip)}><Link2 size={13}/>Copy link</button>
      </div>
    </li>)}
  </ul>;
}

function Ask({ meeting, onSeek }: { meeting: Meeting; onSeek: (ms: number) => void }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<{ answer: string; citations: { segmentId: string; startMs: number; label: string }[] } | null>(null);
  const suggestions = useMemo(() => ["What was decided?", "What are the risks?", ...meeting.chapters.slice(1, 3).map((chapter) => `What was said about ${chapter.title.toLowerCase()}?`)], [meeting.chapters]);

  const ask = async (text: string) => {
    if (!text.trim()) return;
    setQuestion(text);
    setLoading(true);
    const response = await fetch(`/api/meetings/${meeting.id}/ask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: text }) }).catch(() => null);
    setAnswer(response?.ok ? await response.json() : { answer: "Couldn't reach the meeting index. Try again.", citations: [] });
    setLoading(false);
  };

  return <>
    <form className="ask-form" onSubmit={(event) => { event.preventDefault(); void ask(question); }}>
      <input className="input" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about this meeting" aria-label="Ask about this meeting"/>
      <button className="button primary" type="submit" disabled={loading || !question.trim()}>{loading ? "Asking…" : "Ask"}</button>
    </form>
    {!answer && <div className="suggestions">{suggestions.map((text) => <button key={text} type="button" onClick={() => ask(text)}>{text}</button>)}</div>}
    {answer && <div className="ask-answer" aria-live="polite">
      <p>{answer.answer}</p>
      {answer.citations.length > 0 && <div className="toolbar">{answer.citations.map((citation) => <button className="stamp" type="button" key={citation.segmentId} onClick={() => onSeek(citation.startMs)}><Play size={11}/>{citation.label}</button>)}</div>}
    </div>}
  </>;
}

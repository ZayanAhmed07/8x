"use client";
import { Scissors, Search, X } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { clock } from "@/lib/format";
import type { Highlight, Meeting } from "@/lib/types";

type Selection = { startMs: number; endMs: number; x: number; y: number; text: string };

type Props = {
  meeting: Meeting;
  currentMs: number;
  playing: boolean;
  onSeek: (ms: number) => void;
  onCreateClip: (range: { startMs: number; endMs: number; title: string }) => Promise<boolean>;
  canClip: boolean;
  focusRange?: Pick<Highlight, "startMs" | "endMs"> | null;
  children?: ReactNode;
};

function highlight(text: string, query: string): ReactNode {
  if (!query) return text;
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return text;
  return <>{text.slice(0, index)}<mark>{text.slice(index, index + query.length)}</mark>{highlight(text.slice(index + query.length), query)}</>;
}

function segmentAt(node: Node | null) {
  const element = node instanceof Element ? node : node?.parentElement;
  return element?.closest<HTMLElement>("[data-start]") ?? null;
}

export function Transcript({ meeting, currentMs, playing, onSeek, onCreateClip, canClip, focusRange, children }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [follow, setFollow] = useState(true);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const speakers = useMemo(() => new Map(meeting.speakers.map((speaker) => [speaker.id, speaker])), [meeting.speakers]);
  const chapters = useMemo(() => new Map(meeting.chapters.map((chapter) => [chapter.id, chapter.title])), [meeting.chapters]);
  const active = meeting.transcript.find((segment) => currentMs >= segment.startMs && currentMs < segment.endMs);
  const visible = query ? meeting.transcript.filter((segment) => segment.text.toLowerCase().includes(query.toLowerCase())) : meeting.transcript;

  // Keep the spoken line in view while playing, unless the reader has scrolled away.
  useEffect(() => {
    if (!follow || !active || !listRef.current) return;
    const row = listRef.current.querySelector<HTMLElement>(`[data-id="${active.id}"]`);
    if (!row) return;
    const list = listRef.current;
    const top = row.offsetTop - list.offsetTop;
    if (top < list.scrollTop + 40 || top > list.scrollTop + list.clientHeight - 120) list.scrollTo({ top: top - list.clientHeight / 3, behavior: playing ? "smooth" : "auto" });
  }, [active, follow, playing]);

  const onUserScroll = () => { if (playing) setFollow(false); };

  const captureSelection = () => {
    if (!canClip) return;
    const current = window.getSelection();
    if (!current || current.isCollapsed || !listRef.current?.contains(current.anchorNode)) { setSelection(null); return; }
    const first = segmentAt(current.anchorNode);
    const last = segmentAt(current.focusNode);
    if (!first || !last) return;
    const starts = [Number(first.dataset.start), Number(last.dataset.start)];
    const ends = [Number(first.dataset.end), Number(last.dataset.end)];
    const rect = current.getRangeAt(0).getBoundingClientRect();
    const text = current.toString().replace(/\s+/g, " ").trim();
    setSelection({ startMs: Math.min(...starts), endMs: Math.max(...ends), x: rect.left + rect.width / 2, y: rect.top, text });
    setTitle(text.split(" ").slice(0, 8).join(" ").replace(/[,.;:]$/, "") + (text.split(" ").length > 8 ? "…" : ""));
  };

  const save = async () => {
    if (!selection || !title.trim()) return;
    setSaving(true);
    const ok = await onCreateClip({ startMs: selection.startMs, endMs: selection.endMs, title: title.trim() });
    setSaving(false);
    if (ok) { setSelection(null); window.getSelection()?.removeAllRanges(); }
  };

  let lastChapter: string | undefined;
  return <section className="evidence" aria-label="Transcript">
    {children}
    <div className="evidence-head">
      <h2>Transcript</h2>
      {!follow && <button className="button small ghost follow" type="button" onClick={() => setFollow(true)}>Follow playback</button>}
    </div>
    <div className="evidence-search">
      <Search size={15} aria-hidden="true"/>
      <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find in transcript" aria-label="Find in transcript"/>
      {query && <span className="hits">{visible.length} {visible.length === 1 ? "line" : "lines"}</span>}
    </div>
    <div className="transcript" ref={listRef} onMouseUp={captureSelection} onKeyUp={captureSelection} onWheel={onUserScroll} onTouchMove={onUserScroll}>
      {visible.length === 0 && <p className="faint" style={{ padding: 16 }}>{query ? `No line mentions “${query}”.` : "No transcript for this meeting."}</p>}
      {visible.map((segment) => {
        const speaker = speakers.get(segment.speakerId);
        const chapterTitle = !query && segment.chapterId !== lastChapter ? chapters.get(segment.chapterId ?? "") : undefined;
        lastChapter = segment.chapterId;
        const inClip = focusRange && segment.startMs >= focusRange.startMs && segment.endMs <= focusRange.endMs;
        return <Fragment key={segment.id}>
          {chapterTitle && <div className="transcript-chapter">{chapterTitle}</div>}
          <div className={`seg${segment.id === active?.id ? " active" : ""}${inClip ? " in-clip" : ""}`} data-id={segment.id} data-start={segment.startMs} data-end={segment.endMs}>
            <button className="seg-time" type="button" onClick={() => { onSeek(segment.startMs); setFollow(true); }} aria-label={`Jump to ${clock(segment.startMs)}`}>{clock(segment.startMs)}</button>
            <div>
              <div className="seg-speaker"><span className="dot" style={{ "--c": speaker?.color } as CSSProperties}/>{speaker?.name ?? "Unknown"}</div>
              <p className="seg-text">{highlight(segment.text, query)}</p>
            </div>
          </div>
        </Fragment>;
      })}
      {canClip && visible.length > 0 && !query && <p className="faint" style={{ padding: "14px 16px 0", fontSize: 12.5 }}><Scissors size={12} style={{ verticalAlign: -1 }}/> Select any passage to clip and share it.</p>}
    </div>

    {selection && <div className="clip-popover" style={{ left: selection.x, top: selection.y }} role="dialog" aria-label="Create clip" onMouseUp={(event) => event.stopPropagation()}>
      <span className="range mono">{clock(selection.startMs)}–{clock(selection.endMs)}</span>
      <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void save(); if (event.key === "Escape") setSelection(null); }} aria-label="Clip title" autoFocus/>
      <button className="button small accent" type="button" onClick={save} disabled={saving || !title.trim()}><Scissors size={14}/>{saving ? "Saving" : "Clip"}</button>
      <button className="icon-button" type="button" onClick={() => setSelection(null)} aria-label="Cancel"><X size={15}/></button>
    </div>}
  </section>;
}

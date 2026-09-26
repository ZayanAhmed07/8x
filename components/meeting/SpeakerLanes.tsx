"use client";
import { Pause, Play } from "lucide-react";
import { useMemo, useState, type CSSProperties, type MouseEvent } from "react";
import { clock } from "@/lib/format";
import type { Meeting } from "@/lib/types";

const RATES = [1, 1.5, 2];
const QUIET_SHARE = 0.05;

type Props = {
  meeting: Meeting;
  durationMs: number;
  currentMs: number;
  playing: boolean;
  rate: number;
  onSeek: (ms: number) => void;
  onToggle: () => void;
  onRate: (rate: number) => void;
};

export function SpeakerLanes({ meeting, durationMs, currentMs, playing, rate, onSeek, onToggle, onRate }: Props) {
  const [hoverMs, setHoverMs] = useState<number | null>(null);
  const pct = (ms: number) => `${(ms / durationMs) * 100}%`;

  const lanes = useMemo(() => {
    const talked = meeting.speakers.map((speaker) => {
      const segments = meeting.transcript.filter((segment) => segment.speakerId === speaker.id);
      return { speaker, segments, ms: segments.reduce((sum, segment) => sum + segment.endMs - segment.startMs, 0) };
    });
    const total = talked.reduce((sum, lane) => sum + lane.ms, 0) || 1;
    return talked.map((lane) => ({ ...lane, share: lane.ms / total }));
  }, [meeting.speakers, meeting.transcript]);

  const activeSegment = meeting.transcript.find((segment) => currentMs >= segment.startMs && currentMs < segment.endMs);
  const currentChapter = [...meeting.chapters].reverse().find((chapter) => chapter.startMs <= currentMs);
  const quietFlagged = meeting.speakers.length >= 4;

  const msFromEvent = (event: MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return Math.round(((event.clientX - rect.left) / rect.width) * durationMs);
  };

  return <section className="lanes" aria-label="Who spoke when">
    <div className="lanes-bar">
      <button className="play-button" type="button" onClick={onToggle} aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause size={16}/> : <Play size={16} style={{ marginLeft: 2 }}/>}</button>
      <span className="lanes-clock mono"><strong>{clock(currentMs)}</strong> / {clock(durationMs)}</span>
      <span className="rate" role="group" aria-label="Playback speed">{RATES.map((value) => <button key={value} type="button" aria-pressed={rate === value} onClick={() => onRate(value)}>{value}×</button>)}</span>
      {currentChapter && <span className="faint" style={{ fontSize: 13 }}>{currentChapter.title}</span>}
      <span className="lanes-hint">{meeting.videoUrl ? "Click anywhere to jump" : "Transcript playback · click anywhere to jump · Space to play"}</span>
    </div>

    <div className="lanes-grid">
      <div className="lanes-col">
        <span className="lane-spacer chapter-row"/>
        {meeting.highlights.length > 0 && <span className="lane-spacer clip-row"/>}
        {lanes.map(({ speaker }) => <span className="lane-name" key={speaker.id}><span className="dot" style={{ "--c": speaker.color } as CSSProperties}/><span>{speaker.name}</span></span>)}
      </div>

      <div className="lanes-tracks" onMouseMove={(event) => setHoverMs(msFromEvent(event))} onMouseLeave={() => setHoverMs(null)} onClick={(event) => onSeek(msFromEvent(event))}>
        <div className="chapter-track chapter-row">
          {meeting.chapters.map((chapter) => <button type="button" key={chapter.id} className={chapter.id === currentChapter?.id ? "current" : undefined} style={{ left: pct(chapter.startMs), width: pct(chapter.endMs - chapter.startMs) }} title={chapter.title} onClick={(event) => { event.stopPropagation(); onSeek(chapter.startMs); }}>{chapter.title}</button>)}
        </div>
        {meeting.highlights.length > 0 && <div className="clip-track clip-row">{meeting.highlights.map((clip) => <i key={clip.id} title={`Clip: ${clip.title}`} style={{ left: pct(clip.startMs), width: pct(clip.endMs - clip.startMs) }}/>)}</div>}
        {lanes.map(({ speaker, segments }) => <div className="lane-track" key={speaker.id} style={{ "--c": speaker.color } as CSSProperties}>
          {segments.map((segment) => <i key={segment.id} className={segment.id === activeSegment?.id ? "active" : undefined} style={{ left: pct(segment.startMs), width: pct(segment.endMs - segment.startMs) }}/>)}
        </div>)}
        <span className="playhead" style={{ left: pct(currentMs) }}/>
        {hoverMs !== null && <span className="hover-time mono" style={{ left: pct(hoverMs) }}>{clock(hoverMs)}</span>}
      </div>

      <div className="lanes-col">
        <span className="lane-spacer chapter-row"/>
        {meeting.highlights.length > 0 && <span className="lane-spacer clip-row"/>}
        {lanes.map(({ speaker, share }) => {
          const quiet = quietFlagged && share < QUIET_SHARE;
          return <span key={speaker.id} className={`lane-share mono${quiet ? " quiet" : ""}`} title={quiet ? `${speaker.name} spoke for under ${QUIET_SHARE * 100}% of this meeting` : `${speaker.name} spoke for ${Math.round(share * 100)}% of this meeting`}>{Math.round(share * 100)}%</span>;
        })}
      </div>
    </div>
  </section>;
}

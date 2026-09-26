"use client";
import Link from "next/link";
import { Check, CornerDownRight, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/shell/Avatar";
import type { Commitment } from "@/lib/db/commitments";
import { clock, dueLabel, isLate, shortDate } from "@/lib/format";

type Props = {
  item: Commitment;
  color?: string;
  /** The meeting being viewed, so receipts from it seek in place instead of navigating. */
  meetingId?: string;
  onSeek?: (ms: number) => void;
  showOwner?: boolean;
  showSource?: boolean;
  flash?: boolean;
};

export function CommitmentItem({ item, color, meetingId, onSeek, showOwner = true, showSource = false, flash = false }: Props) {
  const router = useRouter();
  const [done, setDone] = useState(item.completed);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const late = isLate(item.dueDate, done);

  const toggle = async () => {
    const next = !done;
    setDone(next);
    setSaving(true);
    setError("");
    const response = await fetch(`/api/meetings/${item.meetingId}/action-items`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, completed: next }) }).catch(() => null);
    setSaving(false);
    if (!response?.ok) { setDone(!next); setError("Couldn't save. Try again."); return; }
    router.refresh();
  };

  const receipt = item.atMs === undefined ? null : item.meetingId === meetingId && onSeek
    ? <button className="stamp" type="button" onClick={() => onSeek(item.atMs!)} title="Play the moment this was agreed"><Play size={11}/>{clock(item.atMs)}</button>
    : <Link className="stamp" href={`/meetings/${item.meetingId}?t=${item.atMs}`} title="Open the moment this was agreed"><Play size={11}/>{showSource || item.meetingId !== meetingId ? `${item.meetingTitle} · ${shortDate(item.meetingDate)} · ` : ""}{clock(item.atMs)}</Link>;

  return <li id={`action-${item.id}`} className={`${done ? "is-done" : ""}${flash ? " flash" : ""}`}>
    <button className="check" type="button" role="checkbox" aria-checked={done} aria-label={done ? `Reopen: ${item.text}` : `Mark done: ${item.text}`} onClick={toggle} disabled={saving}><Check size={13} strokeWidth={3}/></button>
    <div>
      <div className="commitment-text">{item.text}</div>
      <div className="commitment-meta">
        {showOwner && <span className="owner"><Avatar name={item.owner} color={color}/>{item.owner}</span>}
        <span className={`due${late ? " late" : ""}`}>{done ? "Done" : dueLabel(item.dueDate, done)}</span>
        {receipt}
      </div>
      {item.mentions.map((mention) => {
        const here = mention.meetingId === meetingId && onSeek;
        const label = <><CornerDownRight size={13} style={{ marginTop: 3 }}/><span><strong>{here ? "Came up again here" : `Came up again in ${mention.meetingTitle}`}</strong> <span className="mono faint">{clock(mention.atMs)}</span><br/><q>{mention.text.length > 140 ? `${mention.text.slice(0, 140)}…` : mention.text}</q> <span className="faint">{mention.speaker}</span></span></>;
        return here
          ? <button key={mention.meetingId + mention.atMs} className="mention" type="button" style={{ border: "none", borderLeft: "2px solid var(--accent)", width: "100%", textAlign: "left" }} onClick={() => onSeek!(mention.atMs)}>{label}</button>
          : <Link key={mention.meetingId + mention.atMs} className="mention" href={`/meetings/${mention.meetingId}?t=${mention.atMs}`}>{label}</Link>;
      })}
      {error && <p className="due late" role="alert" style={{ marginTop: 6, fontSize: 13 }}>{error}</p>}
    </div>
  </li>;
}

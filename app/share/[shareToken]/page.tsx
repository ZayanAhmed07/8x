import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { CopyLinkButton } from "@/components/shared/CopyShareButton";
import { Avatar, AvatarStack } from "@/components/shell/Avatar";
import { Brand } from "@/components/shell/Brand";
import { getSharedMeetingByToken } from "@/lib/db/queries";
import { asMoment, clock, day, dueLabel, duration, isLate, summarySections } from "@/lib/format";
import type { Meeting, TranscriptSegment } from "@/lib/types";

type Params = { params: Promise<{ shareToken: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const shared = await getSharedMeetingByToken((await params).shareToken);
  if (!shared) return { title: "Not found" };
  return { title: shared.highlight ? `${shared.highlight.title} · ${shared.meeting.title}` : `Recap: ${shared.meeting.title}`, robots: { index: false } };
}

function Excerpt({ meeting, segments }: { meeting: Meeting; segments: TranscriptSegment[] }) {
  const speakers = new Map(meeting.speakers.map((speaker) => [speaker.id, speaker]));
  return <div className="excerpt">{segments.map((segment) => {
    const speaker = speakers.get(segment.speakerId);
    return <div className="seg" key={segment.id}>
      <span className="seg-time">{clock(segment.startMs)}</span>
      <div><div className="seg-speaker"><span className="dot" style={{ "--c": speaker?.color } as CSSProperties}/>{speaker?.name}</div><p className="seg-text">{segment.text}</p></div>
    </div>;
  })}</div>;
}

const within = (meeting: Meeting, startMs: number, endMs: number) => meeting.transcript.filter((segment) => segment.startMs >= startMs && segment.startMs < endMs);

export default async function SharePage({ params }: Params) {
  const { shareToken } = await params;
  const shared = await getSharedMeetingByToken(shareToken);
  if (!shared) notFound();
  const { meeting, highlight } = shared;
  const summary = meeting.summaries.find((item) => item.template === "general") ?? meeting.summaries[0];
  const sections = summary ? summarySections(summary.content) : [];
  const colors = new Map(meeting.speakers.map((speaker) => [speaker.name, speaker.color]));
  const words = sections.flatMap((section) => section.items.map((item) => asMoment(item).text)).join(" ").split(/\s+/).length + meeting.actionItems.length * 12;
  const readMinutes = Math.max(1, Math.round(words / 220));

  return <>
    <header className="share-top"><Brand href="/"/><CopyLinkButton/></header>
    <article className="share-doc">
      {highlight ? <>
        <p className="eyebrow">Clip from {meeting.title} · {day(meeting.date)}</p>
        <h1 style={{ marginTop: 10 }}>{highlight.title}</h1>
        <p className="faint mono" style={{ marginTop: 10, fontSize: 13 }}>{clock(highlight.startMs)}–{clock(highlight.endMs)}</p>
        {meeting.videoUrl && <div className="excerpt"><video src={`${meeting.videoUrl}#t=${highlight.startMs / 1000},${highlight.endMs / 1000}`} controls playsInline/></div>}
        <Excerpt meeting={meeting} segments={within(meeting, highlight.startMs, highlight.endMs + 1)}/>
        {summary && <section><h2>What this meeting decided</h2><p className="headline">{summary.content.headline}</p></section>}
        {meeting.shareToken && <p style={{ marginTop: 28 }}><Link className="text-link" href={`/share/${meeting.shareToken}`}>Read the full recap →</Link></p>}
      </> : <>
        <p className="eyebrow">Meeting recap</p>
        <h1 style={{ marginTop: 10 }}>{meeting.title}</h1>
        <div className="meeting-facts"><span>{day(meeting.date)}</span><span>{duration(meeting.durationSeconds)}</span><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><AvatarStack people={meeting.speakers} max={8}/>{meeting.speakers.length} people</span></div>
        <p className="lede">You weren&apos;t on this call. This is what it decided and who owes what: a {readMinutes}-minute read instead of a {duration(meeting.durationSeconds)} recording.</p>
        {summary && <section><h2>Outcome</h2><p className="headline">{summary.content.headline}</p></section>}
        {sections.map((section) => {
          const kind = /decision/i.test(section.title) ? " decisions" : /quote/i.test(section.title) ? " quotes" : "";
          return <section key={section.title}><h2>{section.title}</h2><ul className={`moments${kind}`}>{section.items.map((raw, index) => {
            const item = asMoment(raw);
            return <li key={index}><p>{kind === " quotes" ? `“${item.text}”` : item.text}{kind === " quotes" && item.speaker && <span className="who">{item.speaker}</span>}</p>{item.atMs !== undefined ? <span className="stamp">{clock(item.atMs)}</span> : <span/>}</li>;
          })}</ul></section>;
        })}
        {meeting.actionItems.length > 0 && <section><h2>Who owes what</h2><ul className="commitments">{meeting.actionItems.map((item) => <li key={item.id} className={item.completed ? "is-done" : undefined}>
          <span className={`check${item.completed ? " on" : ""}`} role="img" aria-label={item.completed ? "Done" : "Open"}>{item.completed ? "✓" : ""}</span>
          <div><div className="commitment-text">{item.text}</div><div className="commitment-meta"><span className="owner"><Avatar name={item.owner} color={colors.get(item.owner)}/>{item.owner}</span><span className={`due${isLate(item.dueDate, item.completed) ? " late" : ""}`}>{item.completed ? "Done" : dueLabel(item.dueDate, item.completed)}</span></div></div>
        </li>)}</ul></section>}
        {meeting.highlights.length > 0 && <section><h2>Worth hearing in full</h2>{meeting.highlights.map((clip) => <div key={clip.id} style={{ marginBottom: 20 }}>
          <h3>{clip.title} <span className="faint mono" style={{ fontWeight: 400, fontSize: 12.5 }}>{clock(clip.startMs)}</span></h3>
          <Excerpt meeting={meeting} segments={within(meeting, clip.startMs, clip.endMs + 1)}/>
        </div>)}</section>}
        {meeting.transcript.length > 0 && <details><summary>Full transcript ({meeting.transcript.length} lines)</summary><Excerpt meeting={meeting} segments={meeting.transcript}/></details>}
      </>}
    </article>
  </>;
}

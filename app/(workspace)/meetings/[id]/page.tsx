import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { MeetingView } from "@/components/meeting/MeetingView";
import { AvatarStack } from "@/components/shell/Avatar";
import { carriedInto, listCommitments } from "@/lib/db/commitments";
import { getMeetingById } from "@/lib/db/queries";
import { day, duration, time } from "@/lib/format";
import { getViewer } from "@/lib/viewer";

type Params = { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string; action?: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const [viewer, { id }] = await Promise.all([getViewer(), params]);
  const meeting = await getMeetingById(id, viewer.workspaceUserId);
  return { title: meeting?.title ?? "Meeting" };
}

export default async function MeetingPage({ params, searchParams }: Params) {
  const [viewer, { id }, query] = await Promise.all([getViewer(), params, searchParams]);
  const [meeting, commitments] = await Promise.all([getMeetingById(id, viewer.workspaceUserId), listCommitments(viewer.workspaceUserId)]);
  if (!meeting) notFound();

  const colors = Object.fromEntries(meeting.speakers.map((speaker) => [speaker.name, speaker.color]));
  const carried = carriedInto(commitments, { id: meeting.id, date: meeting.date, speakerNames: meeting.speakers.map((speaker) => speaker.name) });
  const initialMs = Number.isFinite(Number(query.t)) ? Math.max(0, Number(query.t)) : 0;

  return <div className="page">
    <div className="meeting-head">
      <div>
        <Link className="crumb" href="/meetings"><ChevronLeft size={15}/>Meetings</Link>
        <h1>{meeting.title}</h1>
        <div className="meeting-facts">
          <span>{day(meeting.date)} · <span className="mono">{time(meeting.date)}</span></span>
          <span>{duration(meeting.durationSeconds)}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><AvatarStack people={meeting.speakers} max={8}/>{meeting.speakers.length} people</span>
        </div>
      </div>
    </div>
    <MeetingView meeting={meeting} commitments={commitments.filter((item) => item.meetingId === meeting.id)} carried={carried} colors={colors} initialMs={initialMs} focusActionId={query.action} aiEnabled={Boolean(process.env.GROQ_API_KEY)}/>
  </div>;
}

import { notFound } from "next/navigation";
import { getMeeting } from "@/lib/data";
import { ChapterScrubber } from "@/components/meeting/ChapterScrubber";
import { PlayerTranscriptSync } from "@/components/meeting/PlayerTranscriptSync";
import { SummaryPanel } from "@/components/meeting/SummaryPanel";
import { ActionItemList } from "@/components/meeting/ActionItemList";
import { HighlightCreator } from "@/components/meeting/HighlightCreator";
import { StatusBadge } from "@/components/shared/StatusBadge";
export default async function MeetingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ summary?: "general" | "sales" | "interview" | "standup" }> }) { const [{ id }, query] = await Promise.all([params, searchParams]); const meeting = getMeeting(id); if (!meeting) notFound(); return <><div className="page-head"><div><p className="eyebrow">Meeting detail</p><h1>{meeting.title}</h1><p className="muted">Summary, transcript, actions, highlights, and shareable clips in one workspace.</p></div><StatusBadge status={meeting.status}/></div><ChapterScrubber chapters={meeting.chapters} meetingId={meeting.id}/><PlayerTranscriptSync meeting={meeting}/><div className="grid" style={{marginTop:18}}><SummaryPanel meeting={meeting} template={query.summary}/><ActionItemList meeting={meeting}/><HighlightCreator meeting={meeting}/></div></>; }

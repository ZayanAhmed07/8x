import { notFound } from "next/navigation";
import { getMeeting } from "@/lib/data";
import { ChapterScrubber } from "@/components/meeting/ChapterScrubber";
import { MeetingDetailClient } from "@/components/meeting/MeetingDetailClient";

export default function ScreenshotMeetingDetailPage() {
  const meeting = getMeeting("product-review");
  if (!meeting) notFound();
  return <main className="screenshot-stage"><div className="page-head"><div><h1>{meeting.title}</h1><p className="muted">Video, chapters, and synced transcript in one review surface.</p></div></div><ChapterScrubber chapters={meeting.chapters} meetingId={meeting.id}/><MeetingDetailClient meeting={meeting}/></main>;
}

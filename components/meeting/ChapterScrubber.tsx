import type { CSSProperties } from "react";
import type { Chapter } from "@/lib/data";

export function ChapterScrubber({ chapters, meetingId }: { chapters: Chapter[]; meetingId: string }) {
  const count = Math.max(1, chapters.length - 1);
  return <div className="chapterbar" aria-label="Meeting chapters">{chapters.map((chapter, index) => <a key={chapter.id} href={`/meetings/${meetingId}?t=${chapter.startMs}`} style={{ "--progress": String((index + 1) / (count + 1)) } as CSSProperties}>{chapter.title}</a>)}</div>;
}

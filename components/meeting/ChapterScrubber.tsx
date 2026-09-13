import type { Chapter } from "@/lib/data";
export function ChapterScrubber({ chapters, meetingId }: { chapters: Chapter[]; meetingId: string }) { return <div className="chapterbar">{chapters.map((chapter) => <a key={chapter.id} href={`/meetings/${meetingId}?t=${chapter.startMs}`}>{chapter.title}</a>)}</div>; }

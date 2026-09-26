export type MeetingStatus = "processing" | "ready" | "failed";
export type SummaryTemplate = "general" | "sales" | "interview" | "standup";

export type TranscriptSegment = { id: string; meetingId: string; speakerId: string; startMs: number; endMs: number; text: string; chapterId?: string };
export type Speaker = { id: string; meetingId: string; name: string; avatarUrl: string; color: string };
export type Chapter = { id: string; meetingId: string; title: string; startMs: number; endMs: number; order: number };
export type ActionItem = { id: string; meetingId: string; text: string; owner: string; dueDate: string; completed: boolean; status: "Open" | "Done"; sourceSegmentId?: string };
export type Highlight = { id: string; meetingId: string; startMs: number; endMs: number; title: string; shareToken: string };

/** A summary line that can point back to the moment it came from. */
export type Moment = { text: string; atMs?: number; speaker?: string };
export type SummarySection = { title: string; items: (string | Moment)[] };
export type SummaryContent = {
  headline: string;
  /** Template-specific sections. When absent, sections are derived from the fields below. */
  sections?: SummarySection[];
  bullets: string[];
  decisions: (string | Moment)[];
  keyQuotes: (string | Moment)[];
};
export type Summary = { template: SummaryTemplate; content: SummaryContent };

export type Meeting = {
  id: string; title: string; date: string; durationSeconds: number; status: MeetingStatus; videoUrl: string; mediaKind: "video" | "audio"; summaryTemplate: SummaryTemplate; shareToken?: string;
  speakers: Speaker[]; chapters: Chapter[]; transcript: TranscriptSegment[]; summaries: Summary[]; actionItems: ActionItem[]; highlights: Highlight[];
};

/** An open commitment from an earlier meeting whose owner is in this one. */
export type CarriedCommitment = ActionItem & { meetingTitle: string; meetingDate: string; atMs?: number };

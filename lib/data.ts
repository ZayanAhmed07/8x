export type MeetingStatus = "processing" | "ready" | "failed";
export type SummaryTemplate = "general" | "sales" | "interview" | "standup";

export type TranscriptSegment = { id: string; meetingId: string; speakerId: string; startMs: number; endMs: number; text: string; chapterId?: string };
export type Speaker = { id: string; meetingId: string; name: string; avatarUrl: string; color: string };
export type Chapter = { id: string; meetingId: string; title: string; startMs: number; endMs: number; order: number };
export type ActionItem = { id: string; meetingId: string; text: string; owner: string; dueDate: string; completed: boolean; status: "Open" | "In progress" | "Done"; sourceSegmentId?: string };
export type Highlight = { id: string; meetingId: string; startMs: number; endMs: number; title: string; shareToken: string };
export type Summary = { template: SummaryTemplate; content: { headline: string; bullets: string[]; decisions: string[]; keyQuotes: string[] } };
export type Meeting = {
  id: string; title: string; date: string; durationSeconds: number; status: MeetingStatus; videoUrl: string; summaryTemplate: SummaryTemplate; shareToken?: string;
  speakers: Speaker[]; chapters: Chapter[]; transcript: TranscriptSegment[]; summaries: Summary[]; actionItems: ActionItem[]; highlights: Highlight[];
};

const video = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const colors = ["#b85042", "#586a4d", "#4f5d64", "#8b6f47", "#7f4d57", "#3d6f73", "#9b5f3b", "#6a5c8f"];

function buildTranscript(meetingId: string, speakerIds: string[], chapters: Chapter[], count: number, theme: string): TranscriptSegment[] {
  return Array.from({ length: count }, (_, index) => {
    const startMs = index * 90000;
    const chapter = chapters.find((item) => startMs >= item.startMs && startMs < item.endMs) ?? chapters[chapters.length - 1];
    const speakerId = speakerIds[index % speakerIds.length];
    const prompts = [
      `We should connect ${theme} back to the customer pain instead of treating it like an internal metric.`,
      `The decision I am hearing is to keep the current scope, tighten the handoff, and review the numbers next week.`,
      `There is a risk around timing, but the workaround is clear if ownership stays visible.`,
      `Can we make the recap searchable so someone can jump straight to this part later?`,
      `I will take the follow-up and add the context, deadline, and source moment before end of day.`
    ];
    return { id: `${meetingId}-seg-${index + 1}`, meetingId, speakerId, startMs, endMs: startMs + 65000, chapterId: chapter.id, text: prompts[index % prompts.length] };
  });
}

function summaries(topic: string): Summary[] {
  const base = {
    headline: `${topic} moved from open discussion to clear next steps.`,
    bullets: [`The team aligned on the current priority for ${topic}.`, "Risks were named with owners instead of left as loose concerns.", "Follow-up work was converted into trackable action items."],
    decisions: ["Keep the current scope for the demo.", "Use the recap view as the fastest handoff artifact."],
    keyQuotes: ["Let's make the source moment visible, not just the summary.", "The action item only counts if someone owns it."]
  };
  return ["general", "sales", "interview", "standup"].map((template) => ({ template: template as SummaryTemplate, content: base }));
}

function speakers(meetingId: string, names: string[]): Speaker[] {
  return names.map((name, index) => ({ id: `${meetingId}-sp-${index + 1}`, meetingId, name, avatarUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}`, color: colors[index % colors.length] }));
}

function chapters(meetingId: string, titles: string[], totalMs: number): Chapter[] {
  const span = Math.floor(totalMs / titles.length);
  return titles.map((title, index) => ({ id: `${meetingId}-ch-${index + 1}`, meetingId, title, startMs: index * span, endMs: index === titles.length - 1 ? totalMs : (index + 1) * span, order: index + 1 }));
}

function actions(meetingId: string, owners: string[], count: number): ActionItem[] {
  return Array.from({ length: count }, (_, index) => ({ id: `${meetingId}-act-${index + 1}`, meetingId, text: ["Draft recap for absent stakeholders", "Validate pricing assumption", "Update product review board", "Send customer evidence packet", "Confirm rollout date", "Attach transcript citation", "Review risk register", "Prepare share clip"][index % 8], owner: owners[index % owners.length], dueDate: `2026-09-${16 + index}`, completed: index % 5 === 0, status: index % 5 === 0 ? "Done" : index % 2 === 0 ? "In progress" : "Open", sourceSegmentId: `${meetingId}-seg-${index + 2}` }));
}

function makeMeeting(id: string, title: string, names: string[], durationSeconds: number, chapterTitles: string[], segmentCount: number, status: MeetingStatus = "ready"): Meeting {
  const people = speakers(id, names);
  const chapterRows = chapters(id, chapterTitles, durationSeconds * 1000);
  return { id, title, date: "2026-09-12T15:00:00.000Z", durationSeconds, status, videoUrl: video, summaryTemplate: "general", shareToken: `${id}-public`, speakers: people, chapters: chapterRows, transcript: buildTranscript(id, people.map((p) => p.id), chapterRows, segmentCount, title.toLowerCase()), summaries: summaries(title), actionItems: actions(id, names, id === "product-review" ? 8 : 4), highlights: [{ id: `${id}-hi-1`, meetingId: id, startMs: 180000, endMs: 300000, title: "Decision and owner alignment", shareToken: `${id}-clip-1` }, { id: `${id}-hi-2`, meetingId: id, startMs: 720000, endMs: 840000, title: "Customer-facing recap moment", shareToken: `${id}-clip-2` }] };
}

export const meetings: Meeting[] = [
  makeMeeting("product-review", "Q3 Product Review", ["Maya", "Jon", "Priya", "Leo", "Sam", "Iris", "Nadia", "Owen"], 3720, ["Launch metrics", "Pricing discussion", "Q&A", "Risks and owners"], 42),
  makeMeeting("customer-discovery", "Acme Customer Discovery", ["Avery", "Jordan"], 1500, ["Problem framing", "Current workflow", "Buying criteria"], 18),
  makeMeeting("engineering-standup", "Platform Engineering Standup", ["Rina", "Marco", "Dev", "Tess"], 600, ["Yesterday", "Blockers", "Today"], 12),
  makeMeeting("candidate-interview", "Senior PM Candidate Interview", ["Elena", "Chris"], 2400, ["Background", "Case study", "Team fit", "Close"], 24),
  makeMeeting("sales-demo", "Northstar Sales Demo", ["Morgan", "Casey", "Taylor"], 1800, ["Discovery recap", "Demo", "Security questions", "Next steps"], 20, "processing")
];

export function getMeeting(id: string) { return meetings.find((meeting) => meeting.id === id); }
export function getSharedMeeting(token: string) { return meetings.find((meeting) => meeting.shareToken === token || meeting.highlights.some((h) => h.shareToken === token)); }
export function searchEverything(query: string) {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return meetings.flatMap((meeting) => [
    ...(meeting.title.toLowerCase().includes(q) ? [{ type: "Meeting", title: meeting.title, href: `/meetings/${meeting.id}` }] : []),
    ...meeting.transcript.filter((seg) => seg.text.toLowerCase().includes(q)).slice(0, 4).map((seg) => ({ type: "Transcript", title: seg.text, href: `/meetings/${meeting.id}?t=${seg.startMs}` })),
    ...meeting.actionItems.filter((item) => item.text.toLowerCase().includes(q) || item.owner.toLowerCase().includes(q)).map((item) => ({ type: "Action", title: item.text, href: `/meetings/${meeting.id}?action=${item.id}` }))
  ]);
}

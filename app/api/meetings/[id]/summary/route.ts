import { NextResponse } from "next/server";
import { generateTemplateSummary, saveSummary } from "@/lib/ai/templates";
import { getMeetingById } from "@/lib/db/queries";
import type { SummaryTemplate } from "@/lib/types";
import { getViewer } from "@/lib/viewer";

const TEMPLATES: SummaryTemplate[] = ["general", "sales", "interview", "standup"];

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const [viewer, { id }] = await Promise.all([getViewer(), params]);
  const meeting = await getMeetingById(id, viewer.workspaceUserId);
  return meeting ? NextResponse.json({ summaries: meeting.summaries }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

/** Writes a recap in another template from the stored transcript. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [viewer, { id }] = await Promise.all([getViewer(), params]);
  const meeting = await getMeetingById(id, viewer.workspaceUserId);
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => null);
  const template = body?.template as SummaryTemplate;
  if (!TEMPLATES.includes(template)) return NextResponse.json({ error: "Unknown template." }, { status: 400 });
  if (meeting.transcript.length === 0) return NextResponse.json({ error: "This meeting has no transcript yet." }, { status: 409 });
  try {
    const content = await generateTemplateSummary(meeting, template);
    await saveSummary(meeting.id, template, content);
    return NextResponse.json({ summary: { template, content } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Couldn't write that recap." }, { status: 502 });
  }
}

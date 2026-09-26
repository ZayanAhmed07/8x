import { NextResponse } from "next/server";
import { askMeetings } from "@/lib/ai/ask";
import { getMeetingById } from "@/lib/db/queries";
import { getViewer } from "@/lib/viewer";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [viewer, { id }] = await Promise.all([getViewer(), params]);
  if (!(await getMeetingById(id, viewer.workspaceUserId))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const question = String(body.question ?? "").trim().slice(0, 300);
  return NextResponse.json(await askMeetings(question, viewer.workspaceUserId, id));
}

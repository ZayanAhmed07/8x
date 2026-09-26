import { NextResponse } from "next/server";
import { getMeetingById, setActionCompleted } from "@/lib/db/queries";
import { getViewer } from "@/lib/viewer";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const [viewer, { id }] = await Promise.all([getViewer(), params]);
  const meeting = await getMeetingById(id, viewer.workspaceUserId);
  return meeting ? NextResponse.json({ actionItems: meeting.actionItems }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

// Allowed in the sample workspace too, so visitors can try the flow. `npm run seed` resets it.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [viewer, { id: meetingId }] = await Promise.all([getViewer(), params]);
  if (!(await getMeetingById(meetingId, viewer.workspaceUserId))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => null);
  if (typeof body?.id !== "string" || typeof body.completed !== "boolean") return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const actionItem = await setActionCompleted(meetingId, body.id, body.completed);
  return actionItem ? NextResponse.json({ actionItem }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

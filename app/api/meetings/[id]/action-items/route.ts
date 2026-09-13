import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMeetingById, setActionCompleted } from "@/lib/db/queries";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await params;
  const meeting = await getMeetingById(id, user.id);
  return meeting ? NextResponse.json({ actionItems: meeting.actionItems }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id: meetingId } = await params;
  const meeting = await getMeetingById(meetingId, user.id);
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => null);
  if (!body?.id || typeof body.completed !== "boolean") return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const actionItem = await setActionCompleted(meetingId, body.id, body.completed);
  return actionItem ? NextResponse.json({ actionItem }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
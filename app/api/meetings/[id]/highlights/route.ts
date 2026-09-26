import { NextResponse } from "next/server";
import { createHighlight, getMeetingById } from "@/lib/db/queries";
import { getViewer } from "@/lib/viewer";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const [viewer, { id }] = await Promise.all([getViewer(), params]);
  const meeting = await getMeetingById(id, viewer.workspaceUserId);
  return meeting ? NextResponse.json({ highlights: meeting.highlights }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

// Allowed in the sample workspace too, so visitors can clip and share. `npm run seed` resets it.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [viewer, { id }] = await Promise.all([getViewer(), params]);
  const meeting = await getMeetingById(id, viewer.workspaceUserId);
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 120) : "";
  const { startMs, endMs } = body ?? {};
  const maxMs = meeting.durationSeconds * 1000;
  if (!title || !Number.isInteger(startMs) || !Number.isInteger(endMs) || startMs < 0 || endMs <= startMs || endMs > maxMs) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  return NextResponse.json({ highlight: await createHighlight(id, startMs, endMs, title) }, { status: 201 });
}

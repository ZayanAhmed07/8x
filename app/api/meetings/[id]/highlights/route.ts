import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createHighlight, getMeetingById } from "@/lib/db/queries";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await params;
  const meeting = await getMeetingById(id, user.id);
  return meeting ? NextResponse.json({ highlights: meeting.highlights }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await params;
  const meeting = await getMeetingById(id, user.id);
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => null);
  if (!body?.title || typeof body.startMs !== "number" || typeof body.endMs !== "number") return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const highlight = await createHighlight(id, body.startMs, body.endMs, body.title);
  return NextResponse.json({ highlight }, { status: 201 });
}
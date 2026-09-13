import { NextResponse } from "next/server";
import { askSeeded } from "@/lib/ai/ask";
import { getCurrentUser } from "@/lib/auth";
import { getMeetingById } from "@/lib/db/queries";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await params;
  const meeting = await getMeetingById(id, user.id);
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => ({ question: "" }));
  return NextResponse.json(askSeeded(body.question));
}
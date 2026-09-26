import { NextResponse } from "next/server";
import { askMeetings } from "@/lib/ai/ask";
import { getViewer } from "@/lib/viewer";

export async function POST(request: Request) {
  const viewer = await getViewer();
  const body = await request.json().catch(() => ({}));
  const question = String(body.question ?? "").trim().slice(0, 300);
  return NextResponse.json(await askMeetings(question, viewer.workspaceUserId));
}

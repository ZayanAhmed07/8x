import { NextResponse } from "next/server";
import { listMeetings } from "@/lib/db/queries";
import { getViewer } from "@/lib/viewer";

export async function GET() {
  const viewer = await getViewer();
  return NextResponse.json({ meetings: await listMeetings(viewer.workspaceUserId), demo: viewer.isDemo });
}

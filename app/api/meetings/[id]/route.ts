import { NextResponse } from "next/server";
import { getMeetingById } from "@/lib/db/queries";
import { getViewer } from "@/lib/viewer";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const [viewer, { id }] = await Promise.all([getViewer(), params]);
  const meeting = await getMeetingById(id, viewer.workspaceUserId);
  return meeting ? NextResponse.json({ meeting }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

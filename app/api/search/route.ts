import { NextResponse } from "next/server";
import { searchDatabase } from "@/lib/db/queries";
import { getViewer } from "@/lib/viewer";

export async function GET(request: Request) {
  const viewer = await getViewer();
  const q = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json({ results: await searchDatabase(q, viewer.workspaceUserId) });
}

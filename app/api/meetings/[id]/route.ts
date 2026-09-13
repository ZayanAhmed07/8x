import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMeetingById } from "@/lib/db/queries";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await params;
  const meeting = await getMeetingById(id, user.id);
  return meeting ? NextResponse.json({ meeting }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listMeetings } from "@/lib/db/queries";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  return NextResponse.json({ meetings: await listMeetings(user.id) });
}
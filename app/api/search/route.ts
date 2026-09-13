import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { searchDatabase } from "@/lib/db/queries";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const q = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json({ results: await searchDatabase(q, { userId: user.id }) });
}
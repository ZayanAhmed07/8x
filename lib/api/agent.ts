import { NextResponse } from "next/server";
import { userIdFromAgentToken } from "@/lib/calendar";

/** Resolves the desktop app's bearer token, or returns the 401 to send back. */
export async function requireAgent(request: Request): Promise<{ userId: string } | { response: NextResponse }> {
  const userId = await userIdFromAgentToken(request.headers.get("authorization"));
  return userId ? { userId } : { response: NextResponse.json({ error: "Signed out. Sign in to Tally Capture again." }, { status: 401 }) };
}

export const jsonError = (error: string, status = 400) => NextResponse.json({ error }, { status });

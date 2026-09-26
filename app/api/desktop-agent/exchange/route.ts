import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/agent";
import { exchangeAuthCode, isValidState } from "@/lib/desktop-auth";
import { displayNameFor, storageClient } from "@/lib/storage";

/** Tally Capture trades the one-time code from the browser for its device token. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : "";
  const deviceName = typeof body?.deviceName === "string" ? body.deviceName.trim() : "Desktop";
  if (!code || !isValidState(body?.state)) return jsonError("That sign-in link is invalid. Start again from Tally Capture.");

  const result = await exchangeAuthCode(code, body.state, deviceName);
  if (!result) return jsonError("That code has expired or was already used. Start again from Tally Capture.", 401);

  const [{ data }, name] = await Promise.all([storageClient().auth.admin.getUserById(result.userId), displayNameFor(result.userId)]);
  return NextResponse.json({ token: result.token, user: { email: data.user?.email ?? "", name } });
}

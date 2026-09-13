import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { exchangeGoogleCode } from "@/lib/calendar";
import { encryptText } from "@/lib/crypto";
import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/auth?next=/settings", url.origin));
  const state = url.searchParams.get("state") ?? "";
  const [stateUserId, stateValue] = state.split(".");
  const store = await cookies();
  const expectedState = store.get("google_oauth_state")?.value;
  store.delete("google_oauth_state");
  if (!expectedState || stateUserId !== user.id || stateValue !== expectedState) return NextResponse.redirect(new URL("/settings?google=invalid_state", url.origin));
  const code = url.searchParams.get("code");
  if (!code || url.searchParams.get("error")) return NextResponse.redirect(new URL("/settings?google=denied", url.origin));

  try {
    const token = await exchangeGoogleCode(code);
    if (!token.refresh_token) throw new Error("Google did not return a refresh token.");
    const profile = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${token.access_token}` } }).then((res) => res.ok ? res.json() : null);
    const row = { id: randomUUID(), userId: user.id, email: String(profile?.email ?? user.email ?? "Google account"), accessTokenEncrypted: encryptText(token.access_token), refreshTokenEncrypted: encryptText(token.refresh_token), expiresAt: new Date(Date.now() + Math.max(60, token.expires_in - 60) * 1000), error: null, updatedAt: new Date() };
    await getDb().insert(schema.googleConnections).values(row).onConflictDoUpdate({ target: schema.googleConnections.userId, set: row });
    return NextResponse.redirect(new URL("/settings?google=connected", url.origin));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Calendar connection failed.";
    await getDb().update(schema.googleConnections).set({ error: message }).where(eq(schema.googleConnections.userId, user.id));
    return NextResponse.redirect(new URL("/settings?google=error", url.origin));
  }
}
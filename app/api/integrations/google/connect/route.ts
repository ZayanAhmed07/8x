import { calendarCallbackMatchesSite } from "@/lib/auth/calendar-callback";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildGoogleAuthUrl, googleOAuthConfig } from "@/lib/calendar";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again before connecting your calendar." }, { status: 401 });
  const requestUrl = new URL(request.url);
  try {
    const { redirectUri } = googleOAuthConfig();
    if (!calendarCallbackMatchesSite(redirectUri, requestUrl.origin)) {
      return NextResponse.json({ error: "Calendar setup needs an update from the site owner. The Google callback URL must match this website. You can still upload a recording while this is fixed." }, { status: 503 });
    }
    const state = randomBytes(24).toString("base64url");
    const url = buildGoogleAuthUrl(user.id, state);
    const store = await cookies();
    store.set("google_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: requestUrl.protocol === "https:", maxAge: 600, path: "/" });
    return requestUrl.searchParams.get("format") === "json" ? NextResponse.json({ url: url.toString() }, { headers: { "Cache-Control": "no-store" } }) : NextResponse.redirect(url);
  } catch {
    return NextResponse.json({ error: "Calendar connection is not configured yet. Please contact the site owner or upload a recording to get started." }, { status: 503 });
  }
}

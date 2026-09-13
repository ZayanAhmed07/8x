import { NextResponse } from "next/server";
import { safeReturnPath } from "@/lib/auth/return-path";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  const next = safeReturnPath(url.searchParams.get("next"));

  if (error) {
    const authUrl = new URL("/sign-in", url.origin);
    authUrl.searchParams.set("error", error.slice(0, 160));
    authUrl.searchParams.set("next", next);
    return NextResponse.redirect(authUrl);
  }

  if (!code) {
    const authUrl = new URL("/sign-in", url.origin);
    authUrl.searchParams.set("error", "Missing authentication code.");
    authUrl.searchParams.set("next", next);
    return NextResponse.redirect(authUrl);
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    const authUrl = new URL("/sign-in", url.origin);
    authUrl.searchParams.set("error", exchangeError.message.slice(0, 160));
    authUrl.searchParams.set("next", next);
    return NextResponse.redirect(authUrl);
  }

  return NextResponse.redirect(new URL(next, url.origin));
}

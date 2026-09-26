import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303 so the browser follows with GET; a 307 would re-POST to the sign-in page.
  return NextResponse.redirect(new URL("/sign-in", request.url), 303);
}
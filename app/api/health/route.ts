import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";

export const dynamic = "force-dynamic";

const REQUIRED = ["DATABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "GROQ_API_KEY", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI", "GOOGLE_TOKEN_ENCRYPTION_KEY"];

/** Deployment check: which settings exist (never their values) and whether Postgres answers. */
export async function GET() {
  const env = Object.fromEntries(REQUIRED.map((key) => [key, Boolean(process.env[key]?.trim())]));
  env.NEXT_PUBLIC_SUPABASE_ANON_OR_PUBLISHABLE_KEY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  let database = "ok";
  let demoUser = false;
  try {
    const rows = await getDb().execute<{ n: number }>(sql`select count(*)::int as n from auth.users where email = ${process.env.DEMO_USER_EMAIL ?? "demo@fathom8x.app"}`);
    demoUser = rows[0]?.n > 0;
  } catch (error) {
    // Strip anything that looks like a URL or host so nothing sensitive is echoed.
    database = (error instanceof Error ? error.message : String(error)).replace(/\S+:\/\/\S+/g, "[url]").replace(/[\w.-]+\.(supabase|pooler)\.\S+/g, "[host]").slice(0, 200);
  }
  return NextResponse.json({ database, demoUser, env }, { status: database === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}

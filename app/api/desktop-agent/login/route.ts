import { randomBytes, randomUUID, createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";
import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

export const runtime = "nodejs";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const email =
    typeof body?.email === "string"
      ? body.email.trim().toLowerCase()
      : "";

  const password =
    typeof body?.password === "string"
      ? body.password
      : "";

  if (!email || !email.includes("@")) {
    return errorResponse("Enter a valid email address.");
  }

  if (!password || password.length < 6) {
    return errorResponse("Enter your password.");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return errorResponse(
      "Supabase authentication is not configured.",
      500
    );
  }

  const supabase = createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );

  const { data, error } =
    await supabase.auth.signInWithPassword({
      email,
      password
    });

  if (error || !data.user) {
    return errorResponse("Invalid email or password.", 401);
  }

  const agentToken = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(agentToken);
  const db = getDb();

  await db
    .update(schema.desktopAgentTokens)
    .set({
      revokedAt: new Date()
    })
    .where(
      and(
        eq(schema.desktopAgentTokens.userId, data.user.id),
        isNull(schema.desktopAgentTokens.revokedAt)
      )
    );

  await db.insert(schema.desktopAgentTokens).values({
    id: `agent-${randomUUID()}`,
    userId: data.user.id,
    tokenHash,
    createdAt: new Date(),
    lastUsedAt: null,
    revokedAt: null
  });

  return NextResponse.json({
    token: agentToken,
    user: {
      id: data.user.id,
      email: data.user.email ?? email
    }
  });
}
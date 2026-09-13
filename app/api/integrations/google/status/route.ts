import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
export async function GET() { const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 }); const [connection] = await getDb().select({ email: schema.googleConnections.email, lastSyncedAt: schema.googleConnections.lastSyncedAt, error: schema.googleConnections.error }).from(schema.googleConnections).where(eq(schema.googleConnections.userId, user.id)); return NextResponse.json({ connected: Boolean(connection), connection }); }
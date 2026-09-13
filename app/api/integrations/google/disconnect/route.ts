import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
export async function POST() { const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 }); await getDb().delete(schema.googleConnections).where(eq(schema.googleConnections.userId, user.id)); return NextResponse.json({ disconnected: true }); }
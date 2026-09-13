import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createAgentToken } from "@/lib/calendar";
export async function POST() { const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 }); const token = await createAgentToken(user.id); return NextResponse.json({ token }); }
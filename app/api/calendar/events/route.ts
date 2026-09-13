import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listUpcomingCalendarEvents } from "@/lib/calendar";
export async function GET() { const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 }); const events = await listUpcomingCalendarEvents(user.id); return NextResponse.json({ events }); }
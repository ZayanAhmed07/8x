import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { syncGoogleMeetEvents } from "@/lib/calendar";
export async function POST() { const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 }); try { const synced = await syncGoogleMeetEvents(user.id); return NextResponse.json({ synced }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Calendar sync failed." }, { status: 400 }); } }
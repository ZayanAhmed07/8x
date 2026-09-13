import { NextResponse } from "next/server";
import { getMeeting } from "@/lib/data";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const meeting = getMeeting(id); return meeting ? NextResponse.json({ meeting }) : NextResponse.json({ error: "Not found" }, { status: 404 }); }

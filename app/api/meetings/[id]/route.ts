import { NextResponse } from "next/server";
import { getMeetingById } from "@/lib/db/queries";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const meeting = await getMeetingById(id); return meeting ? NextResponse.json({ meeting }) : NextResponse.json({ error: "Not found" }, { status: 404 }); }

import { NextResponse } from "next/server";
import { listMeetings } from "@/lib/db/queries";
export async function GET() { return NextResponse.json({ meetings: await listMeetings() }); }

import { NextResponse } from "next/server";
import { meetings } from "@/lib/data";
export function GET() { return NextResponse.json({ meetings }); }

import { NextResponse } from "next/server";
import { askSeeded } from "@/lib/ai/ask";
export async function POST(request: Request) { const body = await request.json().catch(() => ({ question: "" })); return NextResponse.json(askSeeded(body.question)); }

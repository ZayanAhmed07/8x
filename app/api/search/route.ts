import { NextResponse } from "next/server";
import { searchEverything } from "@/lib/data";
export function GET(request: Request) { const q = new URL(request.url).searchParams.get("q") ?? ""; return NextResponse.json({ results: searchEverything(q) }); }

import { NextResponse } from "next/server";
import { searchDatabase } from "@/lib/db/queries";
export async function GET(request: Request) { const q = new URL(request.url).searchParams.get("q") ?? ""; return NextResponse.json({ results: await searchDatabase(q) }); }

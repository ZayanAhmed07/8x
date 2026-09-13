import { NextResponse } from "next/server";
export async function POST() { return NextResponse.json({ shareToken: `share-${Date.now()}` }); }

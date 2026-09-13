import { NextResponse } from "next/server";
import { askSeeded } from "@/lib/ai/ask";
import { getCurrentUser } from "@/lib/auth";
import { searchDatabase } from "@/lib/db/queries";

function citationFromHref(href: string, title: string) {
  const match = href.match(/^\/meetings\/([^?]+)\?t=(\d+)/);
  if (!match) return null;
  return { meetingId: match[1], segmentId: `${match[1]}-${match[2]}`, startMs: Number(match[2]), label: title.slice(0, 72) };
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => ({ question: "" }));
  const question = String(body.question ?? "").trim();

  try {
    const results = await searchDatabase(question, { fallback: false, userId: user.id });
    if (results.length === 0) {
      return NextResponse.json({ answer: "No matches found - try a different phrase.", citations: [] });
    }

    const meetings = new Set(results.map((result) => result.href.match(/^\/meetings\/([^?]+)/)?.[1]).filter(Boolean));
    const citations = results.map((result) => citationFromHref(result.href, result.title)).filter((citation) => citation !== null).slice(0, 5);
    const answer = `Found ${results.length} mentions across ${meetings.size} meetings. The strongest matches point to ${results.slice(0, 3).map((result) => result.title).join(" ")}`;

    return NextResponse.json({ answer, citations });
  } catch {
    return NextResponse.json(askSeeded(question));
  }
}
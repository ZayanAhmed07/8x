import Link from "next/link";
import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { AskWorkspace } from "@/components/meeting/AskWorkspace";
import { searchDatabase, type SearchResult } from "@/lib/db/queries";
import { clock } from "@/lib/format";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Search" };

function mark(text: string, query: string): ReactNode {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (!query || index === -1) return text;
  return <>{text.slice(0, index)}<mark>{text.slice(index, index + query.length)}</mark>{mark(text.slice(index + query.length), query)}</>;
}

const KIND: Record<SearchResult["type"], string> = { Meeting: "Title", Transcript: "", Chapter: "Chapter", Action: "Owes" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [viewer, { q = "" }] = await Promise.all([getViewer(), searchParams]);
  const query = q.trim().slice(0, 120);
  const results = query ? await searchDatabase(query, viewer.workspaceUserId) : [];
  const groups = new Map<string, { title: string; results: SearchResult[] }>();
  for (const result of results) {
    const group = groups.get(result.meetingId) ?? { title: result.meetingTitle, results: [] };
    if (result.type !== "Meeting") group.results.push(result);
    groups.set(result.meetingId, group);
  }

  return <div className="page narrow">
    <div className="page-head"><div><h1>Search</h1><p>Find the exact moment something was said, across every meeting.</p></div></div>
    <form className="search-box" role="search">
      <Search size={18} aria-hidden="true"/>
      <input className="input" name="q" defaultValue={query} placeholder="Search for a word, a topic or a person" aria-label="Search meetings" autoFocus={!query}/>
    </form>

    {!query && <AskWorkspace/>}
    {query && <p className="faint" style={{ marginBottom: 14, fontSize: 13.5 }}>{results.length === 0 ? `Nothing matches “${query}”. Try a shorter phrase or a person’s name.` : `${results.length} ${results.length === 1 ? "match" : "matches"} in ${groups.size} ${groups.size === 1 ? "meeting" : "meetings"}`}</p>}

    {[...groups.entries()].map(([meetingId, group]) => <section className="result-group" key={meetingId}>
      <header><Link href={`/meetings/${meetingId}`}>{mark(group.title, query)}</Link><span className="faint" style={{ fontSize: 13 }}>{group.results.length} {group.results.length === 1 ? "match" : "matches"}</span></header>
      {group.results.map((result) => <Link className="result" key={result.href + result.title} href={result.href}>
        <span className="mono faint" style={{ fontSize: 12, paddingTop: 2 }}>{result.startMs !== undefined ? clock(result.startMs) : KIND[result.type]}</span>
        <span>
          {result.speaker && <span className="result-kind">{result.type === "Action" ? `${result.speaker} owes` : result.speaker}</span>}
          {result.type === "Chapter" && <span className="result-kind">Chapter</span>}
          <p className="result-text">{mark(result.title, query)}</p>
        </span>
      </Link>)}
    </section>)}
  </div>;
}

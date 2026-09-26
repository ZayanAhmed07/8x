"use client";
import { Command } from "cmdk";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Result = { type: string; title: string; href: string };
const OPEN_EVENT = "tally:open-search";

export function SearchTrigger() {
  return <button className="search-trigger" type="button" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))} aria-label="Search meetings">
    <Search size={15}/><span>Search meetings</span><kbd>Ctrl K</kbd>
  </button>;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen((value) => !value); }
      if (event.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener(OPEN_EVENT, onOpen); };
  }, []);

  useEffect(() => {
    if (!open || q.trim().length < 2) { setResults([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal }).catch(() => null);
      const data = await response?.json().catch(() => null);
      setResults(data?.results ?? []);
    }, 150);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [open, q]);

  if (!open) return null;
  const go = (href: string) => { setOpen(false); router.push(href); };
  return <div className="command-overlay" onClick={() => setOpen(false)}>
    <Command className="command-panel" shouldFilter={false} onClick={(event) => event.stopPropagation()} label="Search meetings">
      <Command.Input autoFocus value={q} onValueChange={setQ} placeholder="Search what was said, who owes what, or a meeting…"/>
      <Command.List className="command-list">
        {q.trim().length >= 2 && <Command.Empty>Nothing matches “{q}”.</Command.Empty>}
        {q.trim().length < 2 && <div className="faint" style={{ padding: "18px 14px", fontSize: 14 }}><Search size={14} style={{ verticalAlign: -2, marginRight: 6 }}/>Try “SOC 2”, “pricing” or a person’s name.</div>}
        {results.map((result) => <Command.Item key={result.href + result.title} value={result.href + result.title} onSelect={() => go(result.href)}>
          <span className="kind">{result.type}</span><span className="text">{result.title}</span>
        </Command.Item>)}
        {q.trim().length >= 2 && results.length > 0 && <Command.Item value="all-results" onSelect={() => go(`/search?q=${encodeURIComponent(q)}`)}><span className="kind">All</span><span className="text">See every result for “{q}”</span></Command.Item>}
      </Command.List>
    </Command>
  </div>;
}

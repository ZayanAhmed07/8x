"use client";
import { Command } from "cmdk";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

type Result = { type: string; title: string; href: string };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((v) => !v); } }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, []);
  useEffect(() => { if (!open) return; const run = async () => { const response = await fetch(`/api/search?q=${encodeURIComponent(q || "review")}`); const data = await response.json(); setResults(data.results ?? []); }; run(); }, [open, q]);
  if (!open) return null;
  return <div style={{position:"fixed", inset:0, background:"rgba(31,26,23,.25)", zIndex:20}} onClick={() => setOpen(false)}><Command className="card" style={{maxWidth:680, margin:"10vh auto", padding:10}} onClick={(e) => e.stopPropagation()}><div className="toolbar" style={{padding:8}}><Search size={18}/><Command.Input value={q} onValueChange={setQ} className="input" style={{flex:1}} placeholder="Jump to a meeting, transcript moment, action item, or person" /></div><Command.List>{results.map((r) => <Command.Item key={r.href + r.title} onSelect={() => { location.href = r.href; }} className="segment"><strong>{r.type}</strong><span>{r.title}</span></Command.Item>)}</Command.List></Command></div>;
}

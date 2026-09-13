"use client";
import { meetings, searchEverything } from "@/lib/data";
import { Command } from "cmdk";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((v) => !v); } }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, []);
  if (!open) return null;
  const results = q ? searchEverything(q) : meetings.map((m) => ({ type: "Meeting", title: m.title, href: `/meetings/${m.id}` }));
  return <div style={{position:"fixed", inset:0, background:"rgba(31,26,23,.25)", zIndex:20}} onClick={() => setOpen(false)}><Command className="card" style={{maxWidth:680, margin:"10vh auto", padding:10}} onClick={(e) => e.stopPropagation()}><div className="toolbar" style={{padding:8}}><Search size={18}/><Command.Input value={q} onValueChange={setQ} className="input" style={{flex:1}} placeholder="Jump to a meeting, transcript moment, action item, or person" /></div><Command.List>{results.map((r) => <Command.Item key={r.href + r.title} onSelect={() => { location.href = r.href; }} className="segment"><strong>{r.type}</strong><span>{r.title}</span></Command.Item>)}</Command.List></Command></div>;
}

"use client";
import type { Meeting } from "@/lib/data";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
export function ActionItemList({ meeting }: { meeting: Meeting }) { const [done, setDone] = useState(() => new Set(meeting.actionItems.filter((i) => i.completed).map((i) => i.id))); return <section className="card"><h2>Action Items <span className="badge">{done.size}/{meeting.actionItems.length}</span></h2><div className="grid">{meeting.actionItems.map((item) => <button key={item.id} className="segment" onClick={() => setDone((prev) => { const next = new Set(prev); next.has(item.id) ? next.delete(item.id) : next.add(item.id); return next; })}><CheckCircle2 color={done.has(item.id) ? "#586a4d" : "#bbb"}/><span style={{textDecoration: done.has(item.id) ? "line-through" : "none"}}><strong>{item.owner}</strong>: {item.text}<br/><span className="muted">Due {item.dueDate}</span></span></button>)}</div></section>; }

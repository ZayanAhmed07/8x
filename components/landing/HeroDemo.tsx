"use client";
import { useEffect, useState, type CSSProperties } from "react";

// A meeting plays line by line; each promise is pulled into the ledger with its timestamp.
// Lines come from the sample workspace's Q4 planning review.
type Line = { who: string; color: string; at: string; text: string; pull?: { kind: "owes" | "decided" | "late"; label: string; due: string } };

const LINES: Line[] = [
  { who: "Maya", color: "#D9572B", at: "0:04", text: "I want us to leave with owners, not a list of topics." },
  { who: "Nadia", color: "#C2466A", at: "1:46", text: "22% of accounts that start an import never finish it." },
  { who: "Sam", color: "#B8871B", at: "7:13", text: "The SOC 2 report didn't go out. I'll send it today.", pull: { kind: "late", label: "Send Acme the SOC 2 report", due: "6 days late" } },
  { who: "Maya", color: "#D9572B", at: "11:50", text: "Decision: bulk import ships first. SSO moves to November.", pull: { kind: "decided", label: "Import ships before SSO", due: "" } },
  { who: "Jon", color: "#2E7D6B", at: "11:58", text: "I'll write the import spec by Wednesday.", pull: { kind: "owes", label: "Write the import tech spec", due: "Wed" } },
  { who: "Leo", color: "#A2559C", at: "12:06", text: "I'll mock the error review screen by Tuesday.", pull: { kind: "owes", label: "Mock the error review screen", due: "Tue" } }
];
const LANES = [
  { who: "Maya", color: "#D9572B", blocks: [[0, 6], [18, 4], [44, 5], [70, 8]] },
  { who: "Jon", color: "#2E7D6B", blocks: [[8, 5], [36, 7], [62, 4]] },
  { who: "Nadia", color: "#C2466A", blocks: [[12, 6], [26, 5], [80, 5]] },
  { who: "Sam", color: "#B8871B", blocks: [[30, 5], [52, 8]] },
  { who: "Leo", color: "#A2559C", blocks: [[66, 5], [88, 6]] },
  { who: "Owen", color: "#5B6AA8", blocks: [[92, 2]] }
];
const STEP_MS = 1700;

export function HeroDemo() {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(LINES.length); return; }
    const id = window.setInterval(() => setShown((count) => (count >= LINES.length + 2 ? 0 : count + 1)), STEP_MS);
    return () => window.clearInterval(id);
  }, []);

  const visible = LINES.slice(0, Math.min(shown, LINES.length));
  const pulled = visible.filter((line) => line.pull);
  const progress = Math.min(shown / LINES.length, 1);

  return <div className="demo" aria-label="Tally turning a meeting into commitments">
    <div className="demo-chrome">
      <span className="demo-dots" aria-hidden="true"><i/><i/><i/></span>
      <span className="demo-title">Q4 planning review <span>· 8 people</span></span>
      <span className="demo-rec"><i/>Tallying</span>
    </div>

    <div className="demo-lanes" aria-hidden="true">
      {LANES.map((lane) => <div className="demo-lane" key={lane.who} style={{ "--c": lane.color } as CSSProperties}>
        <span>{lane.who}</span>
        <div>{lane.blocks.map(([left, width]) => <i key={left} style={{ left: `${left}%`, width: `${width}%` }}/>)}</div>
      </div>)}
      <span className="demo-playhead" style={{ left: `calc(56px + (100% - 56px) * ${progress})` }}/>
    </div>

    <div className="demo-body">
      <div className="demo-transcript">
        {visible.map((line, index) => <p key={index} className={`demo-line${line.pull && index === visible.length - 1 ? " hot" : ""}`}>
          <span className="demo-at">{line.at}</span>
          <span><b style={{ color: line.color }}>{line.who}</b> {line.text}</span>
        </p>)}
        {shown < LINES.length && <p className="demo-typing" aria-hidden="true"><i/><i/><i/></p>}
      </div>
      <div className="demo-ledger">
        <p className="demo-ledger-title">Who owes what</p>
        {pulled.length === 0 && <p className="demo-empty">Listening for promises…</p>}
        {pulled.map((line) => <div key={line.pull!.label} className={`demo-item ${line.pull!.kind}`}>
          <span className="demo-kind">{line.pull!.kind === "decided" ? "Decided" : line.pull!.kind === "late" ? "Came up again" : line.who}</span>
          <strong>{line.pull!.label}</strong>
          <span className="demo-meta">{line.pull!.due && <em>{line.pull!.due}</em>}<span className="demo-stamp">▶ {line.at}</span></span>
        </div>)}
      </div>
    </div>
  </div>;
}

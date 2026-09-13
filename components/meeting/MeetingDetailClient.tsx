"use client";
import type { Meeting } from "@/lib/data";
import { useState } from "react";
import { ActionItemList } from "@/components/meeting/ActionItemList";
import { HighlightCreator } from "@/components/meeting/HighlightCreator";
import { PlayerTranscriptSync } from "@/components/meeting/PlayerTranscriptSync";

export type HighlightRange = { startMs: number; endMs: number } | null;

export function MeetingDetailClient({ meeting }: { meeting: Meeting }) {
  const [range, setRange] = useState<HighlightRange>(null);
  return <><PlayerTranscriptSync meeting={meeting} onRangeChange={setRange}/><div className="grid" style={{marginTop:18}}><ActionItemList meeting={meeting}/><HighlightCreator meeting={meeting} selectedRange={range}/></div></>;
}

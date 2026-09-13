import type { MeetingStatus } from "@/lib/data";
export function StatusBadge({ status }: { status: MeetingStatus }) { return <span className={`badge ${status}`}>{status}</span>; }

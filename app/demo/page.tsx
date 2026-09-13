import Link from "next/link";
import { meetings } from "@/lib/data";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Clock, Users } from "lucide-react";

export default function DemoPage() {
  return <><div className="page-head"><div><p className="eyebrow">Public demo</p><h1>Demo meetings</h1><p className="muted">Seeded read-only examples for reviewers. Sign in to create private meetings.</p></div><Link className="button primary" href="/auth">Sign in</Link></div><div className="grid cards">{meetings.map((meeting) => <Link className="card" key={meeting.id} href={`/share/${meeting.shareToken}`}><div className="toolbar" style={{justifyContent:"space-between"}}><StatusBadge status={meeting.status}/><span className="muted">{new Date(meeting.date).toLocaleDateString()}</span></div><h2>{meeting.title}</h2><p className="muted">{meeting.summaries[0]?.content.headline}</p><div className="toolbar"><span className="badge"><Clock size={14}/>{Math.round(meeting.durationSeconds / 60)} min</span><span className="badge"><Users size={14}/>{meeting.speakers.length}</span></div></Link>)}</div></>;
}
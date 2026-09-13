import { getSharedMeetingByToken } from "@/lib/db/queries";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CopyShareButton } from "@/components/shared/CopyShareButton";

export default async function SharePage({ params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await params;
  const meeting = await getSharedMeetingByToken(shareToken);
  if (!meeting) notFound();
  const highlight = meeting.highlights.find((h) => h.shareToken === shareToken);
  return <div className="share-shell"><header className="share-top"><Link className="brand" href="/">Fathom Workspace</Link></header><main className="share-main"><div className="page-head"><div><h1>{highlight?.title ?? meeting.title}</h1><p className="muted">Read-only public viewing mode.</p></div><CopyShareButton /></div><video className="video" controls src={meeting.videoUrl}/><section className="card" style={{marginTop:18}}><h2>Recap</h2><p>{meeting.summaries[0]?.content.headline}</p><ul>{meeting.summaries[0]?.content.bullets.map((b) => <li key={b}>{b}</li>)}</ul></section></main></div>;
}

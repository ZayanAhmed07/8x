import { notFound } from "next/navigation";
import { getMeeting } from "@/lib/data";

export default function ScreenshotSharePage() {
  const meeting = getMeeting("product-review");
  if (!meeting) notFound();
  return <main className="screenshot-stage share-main"><div className="page-head"><div><h1>Decision and owner alignment</h1><p className="muted">Read-only public viewing mode.</p></div></div><video className="video" controls src={meeting.videoUrl}/><section className="card" style={{marginTop:18}}><h2>Recap</h2><p>{meeting.summaries[0]?.content.headline}</p><ul>{meeting.summaries[0]?.content.bullets.map((b) => <li key={b}>{b}</li>)}</ul></section></main>;
}

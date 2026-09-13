import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  return <section className="hero"><div className="hero-copy"><h1>Meetings that stay in motion.</h1><p className="hero-subhead">Turn recordings into searchable decisions, action ownership, and shareable moments without making your team babysit another workspace.</p><div className="toolbar"><Link className="button primary" href={user ? "/meetings" : "/sign-in"}>Open workspace</Link><Link className="button" href="/demo">View public demo</Link></div></div><div className="hero-panel" aria-hidden="true"><div className="orbit-card"><span className="badge ready">ready</span><strong>Design Review</strong><p className="muted">3 decisions, 7 actions, 12 transcript anchors</p></div><div className="orbit-card secondary"><span className="badge processing">processing</span><strong>Launch Sync</strong><p className="muted">Recording intelligence compiling</p></div></div></section>;
}

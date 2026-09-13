import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  return <><div className="page-head"><div><p className="eyebrow">Meeting intelligence</p><h1>Fathom Workspace</h1><p className="muted">Review seeded demo meetings publicly, or sign in to create a private meeting workspace.</p></div></div><section className="card"><div className="toolbar"><Link className="button primary" href={user ? "/meetings" : "/auth"}>{user ? "Open workspace" : "Sign in"}</Link><Link className="button" href="/demo">View public demo</Link></div></section></>;
}
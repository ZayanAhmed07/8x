import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return <div className="marketing-shell"><header className="marketing-nav"><Link href="/" className="brand">Fathom Workspace</Link><nav aria-label="Public navigation"><Link href="/sign-in">Log in</Link><Link className="button primary" href={user ? "/meetings" : "/sign-up"}>{user ? "Open workspace" : "Sign up"}</Link></nav></header><main className="marketing-main">{children}</main></div>;
}

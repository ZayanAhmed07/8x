import { WorkspaceNav } from "@/components/shared/WorkspaceNav";
import Link from "next/link";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { getCurrentUser } from "@/lib/auth";
import { LogIn, LogOut } from "lucide-react";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return <><CommandPalette /><aside className="sidebar"><Link href={user ? "/meetings" : "/sign-in"} className="brand"><span>Fathom</span><span>Workspace</span></Link><WorkspaceNav /><div className="account-box">{user ? <><p className="muted">{user.email}</p><form action="/auth/sign-out" method="post"><button className="button" type="submit" aria-label="Sign out"><LogOut size={17}/><span>Sign out</span></button></form></> : <Link className="button primary" href="/sign-in"><LogIn size={17}/>Sign in</Link>}</div></aside><main className="workspace-main">{children}</main></>;
}

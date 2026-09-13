import Link from "next/link";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { getCurrentUser } from "@/lib/auth";
import { CalendarDays, ListChecks, LogIn, LogOut, Search, Settings, Upload } from "lucide-react";

const nav = [
  ["Meetings", "/meetings", CalendarDays],
  ["Actions", "/actions", ListChecks],
  ["Search", "/search", Search],
  ["Upload", "/upload", Upload],
  ["Settings", "/settings", Settings]
] as const;

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return <><CommandPalette /><aside className="sidebar"><Link href={user ? "/meetings" : "/sign-in"} className="brand"><span>Fathom</span><span>Workspace</span></Link><nav aria-label="Workspace navigation">{nav.map(([label, href, Icon]) => <Link key={href} href={href}><Icon size={18}/><span>{label}</span></Link>)}</nav><div className="account-box">{user ? <><p className="muted">{user.email}</p><form action="/auth/sign-out" method="post"><button className="button" type="submit"><LogOut size={17}/>Sign out</button></form></> : <Link className="button primary" href="/sign-in"><LogIn size={17}/>Sign in</Link>}</div></aside><main className="workspace-main">{children}</main></>;
}

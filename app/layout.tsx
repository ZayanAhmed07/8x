import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { getCurrentUser } from "@/lib/auth";
import { CalendarDays, ListChecks, LogIn, LogOut, Search, Settings, Upload } from "lucide-react";

export const metadata: Metadata = { title: "Fathom Workspace", description: "Post-meeting workspace demo" };

const nav = [
  ["Meetings", "/meetings", CalendarDays],
  ["Actions", "/actions", ListChecks],
  ["Search", "/search", Search],
  ["Upload", "/upload", Upload],
  ["Settings", "/settings", Settings]
] as const;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return <html lang="en"><body><CommandPalette /><aside className="sidebar"><Link href={user ? "/meetings" : "/auth"} className="brand">Fathom Workspace</Link><nav>{nav.map(([label, href, Icon]) => <Link key={href} href={href}><Icon size={17}/><span>{label}</span></Link>)}</nav><div className="account-box">{user ? <><p className="muted">{user.email}</p><form action="/auth/sign-out" method="post"><button className="button" type="submit"><LogOut size={17}/>Sign out</button></form></> : <Link className="button primary" href="/auth"><LogIn size={17}/>Sign in</Link>}</div></aside><main>{children}</main></body></html>;
}
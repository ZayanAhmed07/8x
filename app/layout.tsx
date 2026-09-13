import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { CalendarDays, ListChecks, Search, Settings, Upload } from "lucide-react";

export const metadata: Metadata = { title: "Fathom Workspace", description: "Post-meeting workspace demo" };

const nav = [
  ["Meetings", "/meetings", CalendarDays],
  ["Actions", "/actions", ListChecks],
  ["Search", "/search", Search],
  ["Upload", "/upload", Upload],
  ["Settings", "/settings", Settings]
] as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><CommandPalette /><aside className="sidebar"><Link href="/meetings" className="brand">Fathom Workspace</Link><nav>{nav.map(([label, href, Icon]) => <Link key={href} href={href}><Icon size={17}/><span>{label}</span></Link>)}</nav></aside><main>{children}</main></body></html>;
}

"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare, Rows3, Search } from "lucide-react";

const items = [
  { label: "Meetings", href: "/meetings", Icon: Rows3 },
  { label: "Commitments", href: "/actions", Icon: CheckSquare },
  { label: "Search", href: "/search", Icon: Search }
] as const;

export function TopNav() {
  const path = usePathname();
  return <nav className="topnav" aria-label="Workspace">
    {items.map(({ label, href, Icon }) => <Link key={href} href={href} aria-current={path === href || path.startsWith(`${href}/`) ? "page" : undefined}><Icon size={16} aria-hidden="true"/><span>{label}</span></Link>)}
  </nav>;
}

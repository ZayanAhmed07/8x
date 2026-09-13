"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ListChecks, Search, Upload, Settings } from "lucide-react";
const items = [["Meetings", "/meetings", CalendarDays], ["Actions", "/actions", ListChecks], ["Search", "/search", Search], ["Upload", "/upload", Upload], ["Settings", "/settings", Settings]] as const;
export function WorkspaceNav() { const path = usePathname(); return <nav aria-label="Workspace navigation">{items.map(([label, href, Icon]) => <Link key={href} href={href} title={label} aria-current={path === href || path.startsWith(href + "/") ? "page" : undefined}><Icon size={19}/><span>{label}</span></Link>)}</nav>; }

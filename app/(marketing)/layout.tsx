import Link from "next/link";
import { Brand } from "@/components/shell/Brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>
    <header className="topbar"><Brand/><div className="topbar-right"><Link className="button small ghost" href="/meetings">Explore the sample workspace</Link></div></header>
    <main>{children}</main>
  </>;
}

import Link from "next/link";
import { LogOut, Settings, Upload } from "lucide-react";
import { CommandPalette, SearchTrigger } from "@/components/command-palette/CommandPalette";
import { Brand } from "@/components/shell/Brand";
import { TopNav } from "@/components/shell/TopNav";
import { getViewer } from "@/lib/viewer";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  const user = viewer.user;
  return <>
    <CommandPalette/>
    <header className="topbar">
      <Brand/>
      <TopNav/>
      <div className="topbar-right">
        <SearchTrigger/>
        {user ? <div className="account">
          <Link className="button small" href="/upload"><Upload size={15}/><span>Upload</span></Link>
          <Link className="icon-button" href="/settings" aria-label="Settings" title="Settings"><Settings size={17}/></Link>
          <span className="account-email">{user.email}</span>
          <form action="/auth/sign-out" method="post"><button className="icon-button" type="submit" aria-label="Sign out" title="Sign out"><LogOut size={17}/></button></form>
        </div> : <div className="account">
          <Link className="button small ghost" href="/sign-in">Sign in</Link>
          <Link className="button small primary" href="/sign-up">Sign up</Link>
        </div>}
      </div>
    </header>
    {viewer.isDemo && <div className="demo-banner" role="note">
      <span>You&apos;re exploring a sample team&apos;s workspace. It&apos;s real data: tick things off, clip moments, share recaps.</span>
      {user ? <Link href="/upload">Upload a recording</Link> : <Link href="/sign-up">Start your own</Link>}
    </div>}
    <main>{children}</main>
  </>;
}

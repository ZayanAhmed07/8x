import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { DESKTOP_PROTOCOL, isValidState } from "@/lib/desktop-auth";
import { ConnectApproval } from "./ConnectApproval";

export const metadata = { title: "Connect Tally Capture" };

export default async function ConnectDesktopPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const [{ state }, user] = await Promise.all([searchParams, getCurrentUser()]);
  if (!isValidState(state)) {
    return <div className="page narrow" style={{ maxWidth: 520 }}><h1>This link has expired</h1><p className="muted" style={{ marginTop: 12 }}>Open Tally Capture and choose “Sign in with your browser” again.</p></div>;
  }
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/desktop/connect?state=${state}`)}`);
  return <div className="page narrow" style={{ maxWidth: 520, paddingTop: 72 }}>
    <section className="card" style={{ padding: 28 }}>
      <h1 style={{ fontSize: "2rem", marginBottom: 12 }}>Connect Tally Capture</h1>
      <ConnectApproval state={state} email={user.email ?? "your"} protocol={DESKTOP_PROTOCOL}/>
    </section>
  </div>;
}

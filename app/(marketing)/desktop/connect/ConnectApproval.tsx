"use client";
import { Check, Monitor } from "lucide-react";
import { useState, useTransition } from "react";
import { approveDesktop } from "./actions";

export function ConnectApproval({ state, email, protocol }: { state: string; email: string; protocol: string }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const approve = () => startTransition(async () => {
    const result = await approveDesktop(state);
    if (!result.code) { setError(result.error ?? "Something went wrong."); return; }
    setCode(result.code);
    window.location.href = `${protocol}://auth?code=${encodeURIComponent(result.code)}&state=${encodeURIComponent(state)}`;
  });

  if (code) return <div className="grid" style={{ gap: 12 }}>
    <p className="form-message" role="status"><Check size={14} style={{ verticalAlign: -2 }}/> Approved. Tally Capture should open and finish signing in.</p>
    <p className="muted" style={{ fontSize: 14 }}>If it didn&apos;t open, enter this code in the app. It works once, for 5 minutes.</p>
    <p className="mono" style={{ fontSize: 26, letterSpacing: ".08em", padding: "12px 0" }}>{code}</p>
    <p className="faint" style={{ fontSize: 13 }}>You can close this tab.</p>
  </div>;

  return <div className="grid" style={{ gap: 14 }}>
    <p className="muted">Tally Capture will be able to record meetings to <strong>{email}</strong>&apos;s workspace and see your upcoming calendar calls.</p>
    <button className="button primary" type="button" onClick={approve} disabled={pending} style={{ minHeight: 44 }}><Monitor size={16}/>{pending ? "Connecting…" : "Connect Tally Capture"}</button>
    {error && <p className="form-message" role="alert">{error}</p>}
    <p className="faint" style={{ fontSize: 13 }}>Didn&apos;t start this from the app? Close this tab. Nothing happens until you connect.</p>
  </div>;
}

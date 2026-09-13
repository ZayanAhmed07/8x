"use client";

import { ConnectCalendarButton } from "./ConnectCalendarButton";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarSync, KeyRound, Loader2, Unlink } from "lucide-react";

export function CalendarControls({ connected, compact = false }: { connected: boolean; compact?: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  async function runAction(action: "sync" | "token" | "disconnect") {
    setLoading(action);
    setMessage("");
    try {
      const endpoint = action === "token" ? "/api/desktop-agent/token" : `/api/integrations/google/${action}`;
      const response = await fetch(endpoint, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
      if (action === "sync") setMessage(`Synced ${data.synced ?? 0} Google Meet events.`);
      if (action === "token") { setToken(data.token ?? ""); setMessage("Copy this token into the desktop agent. Keep it private."); }
      if (action === "disconnect") { setToken(""); setMessage("Google Calendar disconnected."); }
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Connection failed. Please try again.");
    } finally { setLoading(null); }
  }

  return <div className="grid">{connected ? <div className="toolbar"><button className="button" onClick={() => runAction("sync")} disabled={Boolean(loading)}>{loading === "sync" ? <Loader2 size={17}/> : <CalendarSync size={17}/>}Sync calendar</button>{!compact && <><button className="button" onClick={() => runAction("token")} disabled={Boolean(loading)}><KeyRound size={17}/>New agent token</button><button className="button" onClick={() => runAction("disconnect")} disabled={Boolean(loading)}><Unlink size={17}/>Disconnect</button></>}</div> : <ConnectCalendarButton />}{message ? <p className="muted" role="status">{message}</p> : null}{token ? <input className="input" aria-label="Desktop agent pairing token" readOnly value={token} onFocus={(event) => event.currentTarget.select()} /> : null}</div>;
}
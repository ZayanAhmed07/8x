"use client";

import { useState } from "react";
import { CalendarSync, KeyRound, Loader2, Unlink } from "lucide-react";

export function CalendarControls({ connected }: { connected: boolean }) {
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  async function syncCalendar() {
    setLoading("sync");
    setMessage("");
    const response = await fetch("/api/integrations/google/sync", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setLoading(null);
    setMessage(response.ok ? `Synced ${data.synced ?? 0} Google Meet events.` : data.error ?? "Sync failed.");
  }

  async function createToken() {
    setLoading("token");
    setMessage("");
    const response = await fetch("/api/desktop-agent/token", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setLoading(null);
    if (!response.ok) { setMessage(data.error ?? "Token creation failed."); return; }
    setToken(data.token ?? "");
    setMessage("Copy this token into the desktop agent.");
  }

  async function disconnect() {
    setLoading("disconnect");
    await fetch("/api/integrations/google/disconnect", { method: "POST" });
    location.reload();
  }

  return <div className="grid">{connected ? <div className="toolbar"><button className="button" onClick={syncCalendar} disabled={Boolean(loading)}>{loading === "sync" ? <Loader2 size={17}/> : <CalendarSync size={17}/>}Sync calendar</button><button className="button" onClick={createToken} disabled={Boolean(loading)}><KeyRound size={17}/>New agent token</button><button className="button" onClick={disconnect} disabled={Boolean(loading)}><Unlink size={17}/>Disconnect</button></div> : <a className="button primary" href="/api/integrations/google/connect">Connect Google Calendar</a>}{message ? <p className="muted">{message}</p> : null}{token ? <input className="input" readOnly value={token} onFocus={(event) => event.currentTarget.select()} /> : null}</div>;
}
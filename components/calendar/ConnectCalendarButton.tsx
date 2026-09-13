"use client";
import { useState } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
export function ConnectCalendarButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function connect() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/integrations/google/connect?format=json");
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "Calendar connection could not start. Please try again.");
      window.location.assign(data.url);
    } catch (error) { setError(error instanceof Error ? error.message : "Please check your connection and try again."); setBusy(false); }
  }
  return <div><button className="button primary" onClick={connect} disabled={busy}>{busy ? <Loader2 size={17}/> : <CalendarPlus size={17}/>} {busy ? "Opening Google..." : "Connect Google Calendar"}</button>{error && <p className="connection-error" role="alert">{error}</p>}</div>;
}

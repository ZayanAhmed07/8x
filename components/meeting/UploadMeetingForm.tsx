"use client";
import { UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;
const ALLOWED = new Set(["webm", "mp4", "m4a", "mp3", "wav"]);

type State = "idle" | "uploading" | "processing" | "completed" | "failed";

export function UploadMeetingForm() {
  const router = useRouter();
  const [title, setTitle] = useState("Uploaded meeting");
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");

  const validate = (candidate: File | null) => {
    if (!candidate) return "Choose a recording file.";
    const extension = candidate.name.toLowerCase().split(".").pop() ?? "";
    if (!ALLOWED.has(extension)) return "Use a .webm, .mp4, .m4a, .mp3, or .wav file.";
    if (candidate.size > MAX_UPLOAD_BYTES) return "Recording must be 250MB or smaller.";
    if (candidate.size === 0) return "Recording file is empty.";
    return "";
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const validation = validate(file);
    if (validation) {
      setState("failed");
      setMessage(validation);
      return;
    }

    setState("uploading");
    setMessage("Uploading recording to storage.");
    const form = new FormData();
    form.append("recording", file as File);
    form.append("title", title);

    setState("processing");
    setMessage("Processing transcript and meeting workspace.");
    const response = await fetch("/api/meetings/record", { method: "POST", body: form });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setState("failed");
      setMessage(data.error ?? "Upload failed. Please retry.");
      return;
    }

    setState("completed");
    setMessage("Meeting workspace ready. Redirecting...");
    router.push(`/meetings/${data.meetingId}`);
    router.refresh();
  };

  const busy = state === "uploading" || state === "processing";

  return <section className="card"><UploadCloud size={34}/><h2>Upload a meeting recording</h2><p className="muted">Turn a recording into a searchable meeting workspace.</p><form className="grid" onSubmit={submit}><label>Meeting title<input className="input" value={title} onChange={(event) => setTitle(event.target.value)} disabled={busy}/></label><label>Recording file<input className="input" type="file" accept=".webm,.mp4,.m4a,.mp3,.wav,video/webm,video/mp4,audio/mp4,audio/mpeg,audio/wav" onChange={(event) => { const next = event.target.files?.[0] ?? null; setFile(next); setState("idle"); setMessage(validate(next)); }} disabled={busy}/></label><button className="button primary" disabled={busy}>{busy ? "Working" : "Upload recording"}</button></form>{message && <p><span className={`badge ${state === "failed" ? "failed" : state === "completed" ? "ready" : "processing"}`}>{state}</span> <span className="muted">{message}</span></p>}{state === "failed" && <button className="button" onClick={() => { setState("idle"); setMessage(""); }}>Retry</button>}</section>;
}

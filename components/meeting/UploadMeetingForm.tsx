"use client";
import { UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED = new Set(["webm", "mp4", "m4a", "mp3", "wav", "ogg"]);

function validate(file: File | null) {
  if (!file) return "Choose a recording.";
  if (!ALLOWED.has(file.name.toLowerCase().split(".").pop() ?? "")) return "Use a .webm, .mp4, .m4a, .mp3, .ogg or .wav file.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_UPLOAD_BYTES) return "Recordings must be 25 MB or smaller. An hour of audio usually fits; video often doesn't.";
  return "";
}

/** Reads the media duration locally so the meeting shows its length while it processes. */
function mediaDuration(file: File) {
  return new Promise<number>((resolve) => {
    const element = document.createElement("audio");
    element.preload = "metadata";
    element.onloadedmetadata = () => { resolve(Number.isFinite(element.duration) ? element.duration : 1); URL.revokeObjectURL(element.src); };
    element.onerror = () => resolve(1);
    element.src = URL.createObjectURL(file);
  });
}

export function UploadMeetingForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  const fail = (text: string) => { setFailed(true); setMessage(text); setBusy(false); };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const problem = validate(file);
    if (problem || !file) return fail(problem);
    setBusy(true);
    setFailed(false);
    const name = title.trim() || file.name.replace(/\.[^.]+$/, "");

    setMessage("Preparing upload…");
    const prepare = await fetch("/api/meetings/record", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, size: file.size }) }).catch(() => null);
    const prepared = await prepare?.json().catch(() => null);
    if (!prepare?.ok) return fail(prepared?.error ?? "Couldn't start the upload.");

    setMessage("Uploading…");
    const put = await fetch(prepared.signedUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" }, body: file }).catch(() => null);
    if (!put?.ok) return fail("The upload was interrupted. Try again.");

    const finalize = await fetch(`/api/meetings/record/${prepared.meetingId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: name, contentType: file.type, durationSeconds: await mediaDuration(file) }) }).catch(() => null);
    const finished = await finalize?.json().catch(() => null);
    if (!finalize?.ok) return fail(finished?.error ?? "Couldn't create the meeting.");

    setMessage("Uploaded. Transcribing now…");
    router.push(`/meetings/${prepared.meetingId}`);
  };

  return <section className="card" style={{ padding: 24 }}>
    <form className="grid" onSubmit={submit}>
      <label>Recording<input className="input" type="file" accept=".webm,.mp4,.m4a,.mp3,.wav,.ogg,audio/*,video/webm,video/mp4" onChange={(event) => { const next = event.target.files?.[0] ?? null; setFile(next); setFailed(false); setMessage(validate(next)); }} disabled={busy}/></label>
      <label>Title<input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={file?.name.replace(/\.[^.]+$/, "") ?? "Weekly sync"} disabled={busy}/></label>
      <button className="button primary" disabled={busy || !file} style={{ minHeight: 42 }}><UploadCloud size={16}/>{busy ? "Working…" : "Upload and transcribe"}</button>
    </form>
    {message && <p className={failed ? "form-message" : "muted"} role="status" style={{ marginTop: 14, color: failed ? "var(--late)" : undefined }}>{message}</p>}
    <p className="faint" style={{ marginTop: 14, fontSize: 13 }}>For live meetings, <a className="text-link" href="/settings#recording">Tally Capture</a> records your mic and the call separately, so the transcript knows who said what.</p>
  </section>;
}

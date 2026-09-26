// Recordings are written to disk as they happen, so a crash, a closed laptop or a
// failed upload never loses a meeting. Each recording is a folder:
//   <userData>/recordings/<id>/{manifest.json, mic.webm, system.webm, mix.webm}
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const TRACKS = ["mic", "system", "mix"];

class RecordingStore {
  constructor(root) {
    this.root = root;
    fs.mkdirSync(root, { recursive: true });
  }

  dir(id) {
    if (!/^[a-z0-9-]+$/.test(id)) throw new Error("Invalid recording id.");
    return path.join(this.root, id);
  }

  read(id) {
    try {
      return JSON.parse(fs.readFileSync(path.join(this.dir(id), "manifest.json"), "utf8"));
    } catch {
      return null;
    }
  }

  write(manifest) {
    const file = path.join(this.dir(manifest.id), "manifest.json");
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(manifest, null, 2));
    fs.renameSync(`${file}.tmp`, file);
    return manifest;
  }

  update(id, patch) {
    const current = this.read(id);
    if (!current) throw new Error("Recording not found.");
    return this.write({ ...current, ...patch, updatedAt: new Date().toISOString() });
  }

  create({ title, calendarEventId }) {
    const id = `${new Date().toISOString().slice(0, 10)}-${crypto.randomBytes(4).toString("hex")}`;
    fs.mkdirSync(this.dir(id), { recursive: true });
    const now = new Date().toISOString();
    return this.write({ id, title: title || "Untitled meeting", calendarEventId: calendarEventId || null, startedAt: now, updatedAt: now, durationSeconds: 0, status: "recording", tracks: [], uploaded: [], meetingId: null, error: null });
  }

  append(id, kind, bytes) {
    if (!TRACKS.includes(kind)) throw new Error("Unknown track.");
    fs.appendFileSync(path.join(this.dir(id), `${kind}.webm`), Buffer.from(bytes));
  }

  trackFile(id, kind) {
    return path.join(this.dir(id), `${kind}.webm`);
  }

  /** Who was speaking when, relayed from the Tally for Meet extension. One JSON event per line. */
  appendSpeakerEvents(id, events) {
    if (!events.length) return;
    fs.appendFileSync(path.join(this.dir(id), "speakers.jsonl"), events.map((event) => `${JSON.stringify(event)}\n`).join(""));
  }

  speakerEvents(id) {
    try {
      return fs.readFileSync(path.join(this.dir(id), "speakers.jsonl"), "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
    } catch {
      return [];
    }
  }

  /** Tracks with audio in them. */
  tracksOnDisk(id) {
    return TRACKS.filter((kind) => {
      try { return fs.statSync(this.trackFile(id, kind)).size > 0; } catch { return false; }
    });
  }

  list() {
    return fs.readdirSync(this.root)
      .map((id) => this.read(id))
      .filter(Boolean)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  /** After a successful upload the audio lives in the workspace; keep only the manifest. */
  deleteAudio(id) {
    for (const kind of TRACKS) fs.rmSync(this.trackFile(id, kind), { force: true });
  }

  remove(id) {
    fs.rmSync(this.dir(id), { recursive: true, force: true });
  }

  /** A recording still marked "recording" at startup was cut off by a crash or shutdown. */
  recoverInterrupted() {
    for (const manifest of this.list()) {
      if (manifest.status === "recording") {
        const tracks = this.tracksOnDisk(manifest.id);
        const seconds = Math.round((Date.parse(manifest.updatedAt) - Date.parse(manifest.startedAt)) / 1000);
        this.update(manifest.id, tracks.includes("mix") ? { status: "saved", tracks, durationSeconds: Math.max(manifest.durationSeconds, seconds), error: "Recording was interrupted. Everything up to that point was saved." } : { status: "failed", error: "Recording was interrupted before any audio was saved." });
      }
      if (["uploading", "finalizing"].includes(manifest.status)) this.update(manifest.id, { status: "saved" });
    }
  }
}

module.exports = { RecordingStore, TRACKS };

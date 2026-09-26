// Tally Capture: records your mic and your computer's audio, uploads them to your Tally
// workspace, and tells you when the recap is ready. No bot joins the call.
const { app, BrowserWindow, Menu, Notification, Tray, desktopCapturer, ipcMain, nativeImage, safeStorage, session, shell } = require("electron");
const crypto = require("node:crypto");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { RecordingStore } = require("./store");

const PROTOCOL = "tally-capture";
// The workspace this build talks to. Set at build time in package.json; TALLY_APP_URL overrides it for development.
const APP_URL = (process.env.TALLY_APP_URL || require("../package.json").tally.appUrl).replace(/\/$/, "");
const POLL_MS = 5000;
const POLL_LIMIT_MS = 10 * 60 * 1000;

let win = null;
let tray = null;
let quitting = false;
let recordingId = null;
let pendingSignIn = null; // { state, startedAt }
let store = null;
const reminded = new Set();

// ---------- single instance + deep links ----------

if (!app.requestSingleInstanceLock()) app.quit();
if (process.defaultApp) app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
else app.setAsDefaultProtocolClient(PROTOCOL);

function handleDeepLink(raw) {
  let url;
  try { url = new URL(raw); } catch { return; }
  if (url.protocol !== `${PROTOCOL}:` || url.hostname !== "auth") return;
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  showWindow();
  completeSignIn(code, state).catch((error) => send("auth:error", error.message));
}

app.on("second-instance", (_event, argv) => {
  const link = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
  if (link) handleDeepLink(link);
  else showWindow();
});
app.on("open-url", (event, url) => { event.preventDefault(); handleDeepLink(url); });

// ---------- session ----------

const sessionFile = () => path.join(app.getPath("userData"), "session.bin");
let cachedSession = null; // { token, user: { email, name } }

function saveSession(value) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error("This computer can't store sign-in securely.");
  fs.writeFileSync(sessionFile(), safeStorage.encryptString(JSON.stringify(value)), { mode: 0o600 });
  cachedSession = value;
}

function loadSession() {
  if (cachedSession) return cachedSession;
  try { cachedSession = JSON.parse(safeStorage.decryptString(fs.readFileSync(sessionFile()))); } catch { cachedSession = null; }
  return cachedSession;
}

function clearSession() {
  cachedSession = null;
  fs.rmSync(sessionFile(), { force: true });
  send("auth:changed", publicState());
}

function publicState() {
  const current = loadSession();
  return { signedIn: Boolean(current), user: current?.user ?? null, appUrl: APP_URL, waitingForBrowser: Boolean(pendingSignIn) };
}

class SignedOutError extends Error {}

async function api(pathname, { method = "GET", body } = {}) {
  const current = loadSession();
  if (!current) throw new SignedOutError("Signed out.");
  let response;
  try {
    response = await fetch(`${APP_URL}${pathname}`, { method, headers: { authorization: `Bearer ${current.token}`, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error("Can't reach Tally. Check your connection.");
  }
  if (response.status === 401) { clearSession(); throw new SignedOutError("You were signed out. Sign in again."); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Tally returned ${response.status}.`);
  return data;
}

function beginSignIn() {
  const state = crypto.randomBytes(24).toString("base64url");
  pendingSignIn = { state, startedAt: Date.now() };
  shell.openExternal(`${APP_URL}/desktop/connect?state=${state}`);
  return publicState();
}

async function completeSignIn(code, state) {
  if (!pendingSignIn || state !== pendingSignIn.state) throw new Error("That sign-in link isn't for this window. Choose Sign in again.");
  const response = await fetch(`${APP_URL}/api/desktop-agent/exchange`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, state, deviceName: `${os.hostname()} · ${process.platform === "win32" ? "Windows" : process.platform === "darwin" ? "Mac" : "Linux"}` }) }).catch(() => null);
  const data = await response?.json().catch(() => ({}));
  if (!response?.ok) throw new Error(data?.error || "Couldn't finish signing in.");
  pendingSignIn = null;
  saveSession({ token: data.token, user: data.user });
  send("auth:changed", publicState());
  refreshEvents(true).catch(() => undefined);
}

// ---------- window + tray ----------

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function showWindow() {
  if (!win) return createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function createWindow() {
  win = new BrowserWindow({
    width: 420,
    height: 680,
    minWidth: 360,
    minHeight: 520,
    title: "Tally Capture",
    icon: path.join(__dirname, "assets", "icon.png"),
    backgroundColor: "#F5F3EE",
    autoHideMenuBar: true,
    show: false,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  win.once("ready-to-show", () => win.show());
  // Closing keeps the app in the tray, like any recorder; Quit is in the tray menu.
  win.on("close", (event) => {
    if (quitting) return;
    event.preventDefault();
    win.hide();
    if (recordingId && Notification.isSupported()) new Notification({ title: "Still recording", body: "Tally Capture keeps recording in the tray." }).show();
  });
  // Only the Tally workspace and Meet links open outside the app.
  win.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (event) => event.preventDefault());
}

function updateTray() {
  if (!tray) return;
  const recording = Boolean(recordingId);
  tray.setImage(nativeImage.createFromPath(path.join(__dirname, "assets", recording ? "tray-recording.png" : "tray.png")));
  tray.setToolTip(recording ? "Tally Capture: recording" : "Tally Capture");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: recording ? "● Recording" : loadSession() ? "Ready to record" : "Signed out", enabled: false },
    { type: "separator" },
    recording ? { label: "Stop recording", click: () => send("tray:command", "stop") } : { label: "Start recording", enabled: Boolean(loadSession()), click: () => { showWindow(); send("tray:command", "start"); } },
    { label: "Show Tally Capture", click: showWindow },
    { label: "Open Tally", click: () => shell.openExternal(`${APP_URL}/meetings`) },
    { type: "separator" },
    { label: "Quit", click: () => { quitting = true; app.quit(); } }
  ]));
}

function openExternal(url) {
  const value = String(url || "");
  if (value.startsWith(`${APP_URL}/`) || /^https:\/\/meet\.google\.com\//i.test(value) || /^https:\/\/([a-z0-9-]+\.)?zoom\.us\//i.test(value) || /^https:\/\/teams\.microsoft\.com\//i.test(value)) shell.openExternal(value);
}

// ---------- calendar ----------

let events = [];

async function refreshEvents(sync = false) {
  const data = await api(`/api/desktop-agent/events${sync ? "?sync=1" : ""}`);
  events = data.events || [];
  send("events:changed", events);
  return events;
}

// ---------- settings ----------

const DEFAULT_SETTINGS = { remindMinutes: 2, nudgeAtStart: true };
const settingsFile = () => path.join(app.getPath("userData"), "settings.json");
let settings = { ...DEFAULT_SETTINGS };

function loadSettings() {
  try { settings = { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(settingsFile(), "utf8")) }; } catch { settings = { ...DEFAULT_SETTINGS }; }
}

function saveSettings(patch) {
  const remindMinutes = [0, 1, 2, 5, 10].includes(Number(patch.remindMinutes)) ? Number(patch.remindMinutes) : settings.remindMinutes;
  settings = { ...settings, remindMinutes, nudgeAtStart: patch.nudgeAtStart === undefined ? settings.nudgeAtStart : Boolean(patch.nudgeAtStart) };
  fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
  return settings;
}

// ---------- reminders ----------

function notifyJoin(event, title, body) {
  if (!Notification.isSupported()) return;
  const notification = new Notification({ title, body });
  notification.on("click", () => { showWindow(); send("events:join", event); });
  notification.show();
}

/** A heads-up before each call, and a nudge at start time if nothing is recording yet. */
function remindUpcoming() {
  const now = Date.now();
  for (const event of events) {
    const startsIn = Date.parse(event.startTime) - now;
    const before = `${event.id}:before`;
    const atStart = `${event.id}:start`;
    if (settings.remindMinutes > 0 && startsIn > 60 * 1000 && startsIn <= settings.remindMinutes * 60 * 1000 && !reminded.has(before) && !recordingId) {
      reminded.add(before);
      notifyJoin(event, `${event.title} starts in ${Math.max(1, Math.round(startsIn / 60000))} min`, "Click to join and start recording.");
    }
    if (settings.nudgeAtStart && startsIn <= 0 && startsIn > -3 * 60 * 1000 && !reminded.has(atStart) && !recordingId) {
      reminded.add(atStart);
      notifyJoin(event, `${event.title} is starting`, "You're not recording yet. Click to join and record.");
    }
  }
}

// ---------- meeting detection ----------
// Tally Capture records whatever your computer plays, so it works with any meeting app.
// To offer the right recording at the right time, it watches window titles for a call.
// (Chrome only exposes the active tab's title, so a Meet tab in the background isn't seen.)

const DETECTORS = [
  { app: "Google Meet", match: (title) => title.match(/\bMeet\s*[-–]\s*([a-z]{3}-[a-z]{4}-[a-z]{3})\b/i) ?? title.match(/^(?:Google )?Meet\s*[-–]\s*(.+?)\s*[-–]\s*(?:Google Chrome|Microsoft Edge|Brave|Firefox|Opera|Arc)/i) },
  { app: "Zoom", match: (title) => (/^Zoom Meeting\b|^Zoom Workplace - Meeting|Zoom Webinar/i.test(title) ? [title, ""] : null) },
  { app: "Microsoft Teams", match: (title) => (/\(Meeting\).*Microsoft Teams|Meeting with .+\| Microsoft Teams|Meeting in .+\| Microsoft Teams/i.test(title) ? [title, ""] : null) }
];

let detectedCall = null; // { key, app, code, title, calendarEventId }
let recordedCallKey = null;
let missingPolls = 0;
const offered = new Set();

// ---------- Tally for Meet (browser extension) ----------
// The extension reports the Meet call it's in and who is speaking, over a local-only
// connection. Web pages can't use it: only chrome-extension:// origins are accepted.

const COMPANION_PORT = 47821;
const MEET_FRESH_MS = 8000;
let meetState = null; // { code, title, participants, captions, at }

function companionReply(response, status, body, origin) {
  response.writeHead(status, { "content-type": "application/json", ...(origin ? { "access-control-allow-origin": origin, "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET, POST, OPTIONS" } : {}) });
  response.end(JSON.stringify(body));
}

function startCompanionServer() {
  const server = http.createServer((request, response) => {
    const origin = request.headers.origin || "";
    if (!origin.startsWith("chrome-extension://")) return companionReply(response, 403, { error: "Only the Tally for Meet extension can connect." });
    if (request.method === "OPTIONS") return companionReply(response, 204, {}, origin);
    const manifest = recordingId ? store.read(recordingId) : null;
    const status = { app: "tally-capture", signedIn: Boolean(loadSession()), recording: Boolean(recordingId), title: manifest?.title ?? "" };
    if (request.method === "GET" && request.url === "/v1/status") return companionReply(response, 200, status, origin);
    if (request.method !== "POST" || request.url !== "/v1/meet") return companionReply(response, 404, { error: "Not found." }, origin);

    let raw = "";
    request.on("data", (chunk) => { raw += chunk; if (raw.length > 512 * 1024) request.destroy(); });
    request.on("end", () => {
      let body;
      try { body = JSON.parse(raw); } catch { return companionReply(response, 400, { error: "Bad JSON." }, origin); }
      const code = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(body.code) ? body.code : "";
      if (body.state === "in-call" && code) {
        meetState = { code, title: String(body.title || code).slice(0, 120), participants: Array.isArray(body.participants) ? body.participants.slice(0, 50).map((name) => String(name).slice(0, 60)) : [], captions: Boolean(body.captions), at: Date.now() };
      } else if (body.state === "left" && meetState?.code === code) {
        meetState = null;
        watchForCalls().catch(() => undefined);
      }
      const events = (Array.isArray(body.events) ? body.events : []).filter((event) => Number.isFinite(event?.t) && typeof event?.name === "string").slice(0, 2000).map((event) => ({ t: event.t, name: event.name.slice(0, 60) }));
      if (recordingId && events.length) store.appendSpeakerEvents(recordingId, events);
      companionReply(response, 200, status, origin);
    });
  });
  // If the port is taken (another copy running), the app still works; only names are missing.
  server.on("error", (error) => console.error("companion server:", error.message));
  server.listen(COMPANION_PORT, "127.0.0.1");
}

async function detectCall() {
  // The extension knows about Meet calls even in background tabs, and has the real title.
  if (meetState && Date.now() - meetState.at < MEET_FRESH_MS) {
    const event = events.find((item) => item.meetUrl?.toLowerCase().includes(meetState.code));
    return { key: `Google Meet:${meetState.code}`, app: "Google Meet", code: meetState.code, title: event?.title ?? meetState.title, calendarEventId: event?.id ?? null, names: meetState.captions };
  }
  const sources = await desktopCapturer.getSources({ types: ["window"], thumbnailSize: { width: 0, height: 0 }, fetchWindowIcons: false }).catch(() => []);
  for (const { name } of sources) {
    for (const detector of DETECTORS) {
      const match = detector.match(name);
      if (!match) continue;
      const code = detector.app === "Google Meet" && /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i.test(match[1]) ? match[1].toLowerCase() : "";
      // A calendar event with the same Meet code gives us the real meeting name.
      const event = code ? events.find((item) => item.meetUrl?.toLowerCase().includes(code)) : null;
      return { key: `${detector.app}:${code || name}`, app: detector.app, code, title: event?.title ?? (code ? `Google Meet call (${code})` : detector.app === "Google Meet" && match[1] ? match[1] : `${detector.app} call`), calendarEventId: event?.id ?? null };
    }
  }
  return null;
}

async function watchForCalls() {
  if (!loadSession()) return;
  const call = await detectCall();
  const changed = call?.key !== detectedCall?.key;
  detectedCall = call;
  if (changed) send("call:detected", call);

  if (recordingId) {
    // The call we're recording has closed: remind, never stop on our own.
    if (recordedCallKey && !call) {
      missingPolls += 1;
      if (missingPolls === 2 && Notification.isSupported()) {
        const notification = new Notification({ title: "Did your call end?", body: "Tally Capture is still recording. Click to stop and upload." });
        notification.on("click", () => { showWindow(); send("tray:command", "stop"); });
        notification.show();
      }
    } else missingPolls = 0;
    return;
  }
  recordedCallKey = null;
  if (call && !offered.has(call.key) && Notification.isSupported()) {
    offered.add(call.key);
    const notification = new Notification({ title: `${call.app} call detected`, body: `Record “${call.title}” with Tally?` });
    notification.on("click", () => { showWindow(); send("call:record", call); });
    notification.show();
  }
}

// ---------- recordings ----------

function broadcastRecordings() {
  send("recordings:changed", store.list().slice(0, 8));
}

async function putFile(url, file) {
  const response = await fetch(url, { method: "PUT", headers: { "content-type": "audio/webm", "x-upsert": "true" }, body: fs.readFileSync(file) }).catch(() => null);
  if (!response?.ok) throw new Error("Upload was interrupted.");
}

/** Upload → create meeting → wait for the recap. Safe to call again after any failure. */
async function uploadRecording(id) {
  let manifest = store.read(id);
  if (!manifest || !["saved", "failed"].includes(manifest.status) || manifest.audioDeleted) return;
  const tracks = store.tracksOnDisk(id);
  if (!tracks.includes("mix") && !manifest.meetingId) { store.update(id, { status: "failed", error: "No audio was recorded." }); return broadcastRecordings(); }
  try {
    store.update(id, { status: "uploading", error: null });
    broadcastRecordings();
    // Signed upload URLs last about two hours; a retry after that needs fresh ones.
    const stale = manifest.preparedAt && Date.now() - Date.parse(manifest.preparedAt) > 90 * 60 * 1000 && manifest.status !== "processing";
    if (!manifest.uploadsPrepared || stale) {
      const prepared = await api("/api/desktop-agent/recordings", { method: "POST", body: { tracks: tracks.map((kind) => ({ kind, size: fs.statSync(store.trackFile(id, kind)).size })) } });
      manifest = store.update(id, { meetingId: prepared.meetingId, uploadsPrepared: prepared.uploads, uploaded: [], preparedAt: new Date().toISOString() });
    }
    for (const upload of manifest.uploadsPrepared) {
      if (manifest.uploaded.includes(upload.kind)) continue;
      await putFile(upload.signedUrl, store.trackFile(id, upload.kind));
      manifest = store.update(id, { uploaded: [...manifest.uploaded, upload.kind] });
      broadcastRecordings();
    }
    await api(`/api/desktop-agent/recordings/${manifest.meetingId}`, { method: "POST", body: { title: manifest.title, startedAt: manifest.startedAt, durationSeconds: manifest.durationSeconds, calendarEventId: manifest.calendarEventId, speakerTimeline: speakerTimeline(manifest) } });
    store.deleteAudio(id);
    store.update(id, { status: "processing", audioDeleted: true });
    broadcastRecordings();
    await waitForRecap(id);
  } catch (error) {
    if (error instanceof SignedOutError) store.update(id, { status: "saved", error: "Sign in to upload this recording." });
    else store.update(id, { status: store.read(id)?.status === "processing" ? "processing" : "failed", error: error.message });
    broadcastRecordings();
  }
}

function speakerTimeline(manifest) {
  const speakerEvents = store.speakerEvents(manifest.id);
  if (!speakerEvents.length || !manifest.startedAtMs) return undefined;
  return { startedAtMs: manifest.startedAtMs, pauses: manifest.pauses ?? [], events: speakerEvents };
}

async function waitForRecap(id) {
  const { meetingId, title } = store.read(id);
  const deadline = Date.now() + POLL_LIMIT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    const { status } = await api(`/api/desktop-agent/recordings/${meetingId}`).catch(() => ({ status: "processing" }));
    if (status === "ready" || status === "failed") {
      store.update(id, { status: status === "ready" ? "ready" : "failed", error: status === "failed" ? "Tally couldn't transcribe this recording." : null });
      broadcastRecordings();
      if (status === "ready" && Notification.isSupported()) {
        const notification = new Notification({ title: "Recap ready", body: `${title}: decisions and commitments are in Tally.` });
        notification.on("click", () => shell.openExternal(`${APP_URL}/meetings/${meetingId}`));
        notification.show();
      }
      return;
    }
  }
}

// ---------- IPC ----------

function handle(channel, fn) {
  ipcMain.handle(channel, async (_event, ...args) => {
    try { return { ok: true, value: await fn(...args) }; } catch (error) { return { ok: false, error: error.message }; }
  });
}

handle("auth:state", async () => {
  if (loadSession()) {
    // Confirm the token is still valid and refresh the profile.
    const me = await api("/api/desktop-agent/me").catch((error) => { if (error instanceof SignedOutError) return null; return undefined; });
    if (me) { saveSession({ ...loadSession(), user: { email: me.email, name: me.name } }); return { ...publicState(), calendarConnected: me.calendarConnected }; }
  }
  return publicState();
});
handle("auth:begin", beginSignIn);
handle("auth:cancel", () => { pendingSignIn = null; return publicState(); });
handle("auth:code", (code) => completeSignIn(String(code || ""), pendingSignIn?.state ?? ""));
handle("auth:signOut", async () => {
  await api("/api/desktop-agent/me", { method: "DELETE" }).catch(() => undefined);
  clearSession();
  updateTray();
  return publicState();
});

handle("events:list", (sync) => refreshEvents(Boolean(sync)));
handle("call:current", () => detectedCall);
handle("settings:get", () => settings);
handle("settings:set", (patch) => saveSettings(patch || {}));

// Calendar is connected in the browser; the app notices on its own.
let calendarWatch = null;
handle("calendar:connect", () => {
  shell.openExternal(`${APP_URL}/desktop/calendar`);
  clearInterval(calendarWatch);
  const until = Date.now() + 5 * 60 * 1000;
  calendarWatch = setInterval(async () => {
    const me = await api("/api/desktop-agent/me").catch(() => null);
    if (me?.calendarConnected) {
      clearInterval(calendarWatch);
      send("calendar:connected", true);
      refreshEvents(true).catch(() => undefined);
    } else if (Date.now() > until) clearInterval(calendarWatch);
  }, 4000);
  return true;
});

handle("recordings:list", () => store.list().slice(0, 8));
handle("recording:start", ({ title, calendarEventId }) => {
  if (!loadSession()) throw new Error("Sign in first.");
  if (recordingId) throw new Error("Already recording.");
  const manifest = store.create({ title, calendarEventId });
  recordingId = manifest.id;
  recordedCallKey = detectedCall?.key ?? null;
  missingPolls = 0;
  updateTray();
  broadcastRecordings();
  return manifest;
});
ipcMain.on("recording:chunk", (_event, { id, kind, data }) => {
  try { store.append(id, kind, data); store.update(id, {}); } catch (error) { console.error("chunk", error); }
});
handle("recording:rename", ({ id, title }) => store.update(id, { title: String(title || "Untitled meeting").slice(0, 120) }));
// startedAtMs and pauses (wall-clock) let the server line speaker names up with the audio.
handle("recording:finish", ({ id, durationSeconds, startedAtMs, pauses }) => {
  recordingId = null;
  updateTray();
  store.update(id, { status: "saved", durationSeconds: Math.max(1, Math.round(durationSeconds)), tracks: store.tracksOnDisk(id), startedAtMs: Number(startedAtMs) || null, pauses: Array.isArray(pauses) ? pauses : [] });
  broadcastRecordings();
  uploadRecording(id);
  return store.read(id);
});
handle("recording:retry", (id) => { uploadRecording(id); return true; });
handle("recording:discard", (id) => { store.remove(id); broadcastRecordings(); return true; });

handle("open:meeting", (meetingId) => shell.openExternal(`${APP_URL}/meetings/${encodeURIComponent(meetingId)}`));
handle("open:app", (pathname) => shell.openExternal(`${APP_URL}${String(pathname || "/meetings").startsWith("/") ? pathname : "/meetings"}`));
handle("open:external", (url) => openExternal(url));

// ---------- startup ----------

app.whenReady().then(() => {
  if (process.platform === "win32") app.setAppUserModelId("app.tally.capture");
  Menu.setApplicationMenu(null);
  store = new RecordingStore(path.join(app.getPath("userData"), "recordings"));
  store.recoverInterrupted();
  loadSettings();
  startCompanionServer();

  // The computer's audio comes from a loopback capture of the screen; we never record the picture.
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ["screen"] }).then((sources) => callback({ video: sources[0], audio: "loopback" })).catch(() => callback({}));
  });
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => callback(["media", "notifications"].includes(permission)));

  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, "assets", "tray.png")));
  tray.on("click", showWindow);
  updateTray();
  createWindow();

  const link = process.argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
  if (link) win.webContents.once("did-finish-load", () => handleDeepLink(link));

  setInterval(() => { if (loadSession()) refreshEvents(false).catch(() => undefined); }, 5 * 60 * 1000);
  setInterval(remindUpcoming, 30 * 1000);
  setInterval(() => watchForCalls().catch(() => undefined), 10 * 1000);
  // Pick up anything left unuploaded from a previous run.
  if (loadSession()) for (const manifest of store.list()) if (manifest.status === "saved" && !manifest.error?.startsWith("Recording was interrupted")) uploadRecording(manifest.id);
});

app.on("before-quit", () => { quitting = true; });
app.on("window-all-closed", () => { /* stay in the tray */ });

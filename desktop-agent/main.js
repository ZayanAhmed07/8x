const { app, BrowserWindow, desktopCapturer, ipcMain, shell } = require("electron");
const path = require("node:path");

app.setAsDefaultProtocolClient("fathom-clone");
const gotLock = app.requestSingleInstanceLock();
let win;
let pendingEvent = null;

function sanitizeDeepLink(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "fathom-clone:" || url.hostname !== "record") return null;
    const meetUrl = url.searchParams.get("meetUrl") || "";
    if (!/^https:\/\/meet\.google\.com\/[a-z0-9-]+/i.test(meetUrl)) return null;
    return { id: (url.searchParams.get("eventId") || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 96), title: (url.searchParams.get("title") || "Google Meet").slice(0, 140), meetUrl };
  } catch { return null; }
}

function normalizeAppUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) throw new Error("Enter the application URL before syncing or uploading.");
  let url;
  try { url = new URL(value); } catch { throw new Error("Enter a valid application URL."); }
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (isLocal && url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Local development URLs must use http://localhost or https://localhost.");
  if (!isLocal && url.protocol !== "https:") throw new Error("Production application URLs must use HTTPS.");
  url.pathname = url.pathname.replace(/\/$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function authHeaders(token, json = false) {
  const value = String(token || "").trim();
  if (!value) throw new Error("Paste the desktop agent token from the web app before syncing or uploading.");
  return json ? { authorization: `Bearer ${value}`, "content-type": "application/json" } : { authorization: `Bearer ${value}` };
}

async function readApiError(response) {
  const text = await response.text().catch(() => "");
  if (!text) return `Request failed with status ${response.status}.`;
  try {
    const data = JSON.parse(text);
    return data?.error || data?.message || text;
  } catch {
    return text;
  }
}

function safeFileName(input) {
  return String(input || "captured-meeting").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 64) || "captured-meeting";
}

function sendEvent(event) {
  pendingEvent = event;
  if (win?.webContents) win.webContents.send("calendar:event", event);
}

function createWindow() {
  win = new BrowserWindow({ width: 520, height: 720, alwaysOnTop: true, resizable: true, title: "Fathom Capture", webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: false } });
  win.loadFile(path.join(__dirname, "recorder-window.html"));
  win.webContents.once("did-finish-load", () => { if (pendingEvent) sendEvent(pendingEvent); });
}

if (!gotLock) app.quit();
app.on("second-instance", (_event, argv) => { const link = argv.find((arg) => arg.startsWith("fathom-clone://")); if (link) sendEvent(sanitizeDeepLink(link)); if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on("open-url", (event, url) => { event.preventDefault(); sendEvent(sanitizeDeepLink(url)); });

ipcMain.handle("capture:sources", async () => {
  const sources = await desktopCapturer.getSources({ types: ["screen", "window"], thumbnailSize: { width: 240, height: 135 } });
  return sources.map((source) => ({ id: source.id, name: source.name, thumbnail: source.thumbnail.toDataURL() }));
});

ipcMain.handle("agent:events", async (_event, { appUrl, token }) => {
  const baseUrl = normalizeAppUrl(appUrl);
  const response = await fetch(`${baseUrl}/api/desktop-agent/events`, { headers: authHeaders(token) });
  if (!response.ok) throw new Error(await readApiError(response));
  return response.json();
});

ipcMain.handle("open:external", async (_event, url) => { if (/^https:\/\/meet\.google\.com\//i.test(url)) await shell.openExternal(url); });

ipcMain.handle("recording:upload", async (_event, { buffer, title, durationSeconds, appUrl, token, calendarEventId }) => {
  const baseUrl = normalizeAppUrl(appUrl);
  const fileBuffer = Buffer.from(buffer);
  const contentType = "video/webm";
  const fileName = `${safeFileName(title)}-${Date.now()}.webm`;
  const headers = authHeaders(token, true);

  const uploadInit = await fetch(`${baseUrl}/api/desktop-agent/events`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "prepare-upload", fileName, contentType, size: fileBuffer.byteLength })
  });
  if (!uploadInit.ok) throw new Error(await readApiError(uploadInit));
  const uploadData = await uploadInit.json();
  if (!uploadData?.signedUrl || !uploadData?.meetingId || !uploadData?.objectPath) {
    throw new Error("The app did not return a valid recording upload URL.");
  }

  const upload = await fetch(uploadData.signedUrl, {
    method: "PUT",
    headers: { "content-type": contentType, "x-upsert": "false" },
    body: fileBuffer
  });
  if (!upload.ok) throw new Error(await readApiError(upload));

  const finalize = await fetch(`${baseUrl}/api/desktop-agent/events`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "finalize-recording",
      meetingId: uploadData.meetingId,
      objectPath: uploadData.objectPath,
      title: title || "Captured meeting",
      durationSeconds: durationSeconds || 1,
      calendarEventId,
      contentType,
      fileName,
      size: fileBuffer.byteLength
    })
  });
  if (!finalize.ok) throw new Error(await readApiError(finalize));
  return finalize.json();
});

for (const arg of process.argv) { if (arg.startsWith("fathom-clone://")) pendingEvent = sanitizeDeepLink(arg); }
app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

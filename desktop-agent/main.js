const { app, BrowserWindow, desktopCapturer, ipcMain } = require("electron");
const path = require("node:path");

function createWindow() {
  const win = new BrowserWindow({
    width: 420,
    height: 560,
    alwaysOnTop: true,
    resizable: false,
    title: "Fathom Capture",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  win.loadFile(path.join(__dirname, "recorder-window.html"));
}

ipcMain.handle("capture:sources", async () => {
  const sources = await desktopCapturer.getSources({ types: ["screen", "window"], thumbnailSize: { width: 240, height: 135 } });
  return sources.map((source) => ({ id: source.id, name: source.name, thumbnail: source.thumbnail.toDataURL() }));
});

ipcMain.handle("recording:upload", async (_event, { buffer, title, durationSeconds, appUrl }) => {
  const blob = new Blob([Buffer.from(buffer)], { type: "video/webm" });
  const form = new FormData();
  form.append("recording", blob, "recording.webm");
  form.append("title", title || "Captured meeting");
  form.append("duration", String(durationSeconds || 0));
  const response = await fetch(`${appUrl.replace(/\/$/, "")}/api/meetings/record`, { method: "POST", body: form });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

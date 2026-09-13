const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("captureAgent", {
  getSources: () => ipcRenderer.invoke("capture:sources"),
  getEvents: ({ appUrl, token }) => ipcRenderer.invoke("agent:events", { appUrl, token }),
  openExternal: (url) => ipcRenderer.invoke("open:external", url),
  onCalendarEvent: (callback) => ipcRenderer.on("calendar:event", (_event, data) => callback(data)),
  uploadRecording: ({ blob, title, durationSeconds, appUrl, token, calendarEventId }) => blob.arrayBuffer().then((buffer) => ipcRenderer.invoke("recording:upload", { buffer, title, durationSeconds, appUrl, token, calendarEventId }))
});
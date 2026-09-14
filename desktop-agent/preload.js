const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("captureAgent", {
  getSources: () => ipcRenderer.invoke("capture:sources"),
  getEvents: ({ appUrl, token }) => ipcRenderer.invoke("agent:events", { appUrl, token }),
  openExternal: (url) => ipcRenderer.invoke("open:external", url),
  onCalendarEvent: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("calendar:event", listener);
    return () => ipcRenderer.removeListener("calendar:event", listener);
  },
  uploadRecording: ({ blob, title, durationSeconds, appUrl, token, calendarEventId }) => blob.arrayBuffer().then((buffer) => ipcRenderer.invoke("recording:upload", { buffer, title, durationSeconds, appUrl, token, calendarEventId }))
});

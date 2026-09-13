const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("captureAgent", {
  getSources: () => ipcRenderer.invoke("capture:sources"),
  uploadRecording: ({ blob, title, durationSeconds, appUrl }) => blob.arrayBuffer().then((buffer) => ipcRenderer.invoke("recording:upload", { buffer, title, durationSeconds, appUrl }))
});

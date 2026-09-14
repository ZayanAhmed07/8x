const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("captureAgent", {
  getSources: () =>
    ipcRenderer.invoke("capture:sources"),

  login: ({ appUrl, email, password }) =>
    ipcRenderer.invoke("agent:login", {
      appUrl,
      email,
      password
    }),

  getSession: () =>
    ipcRenderer.invoke("agent:session"),

  logout: () =>
    ipcRenderer.invoke("agent:logout"),

  getEvents: ({ appUrl }) =>
    ipcRenderer.invoke("agent:events", {
      appUrl
    }),

  openExternal: (url) =>
    ipcRenderer.invoke("open:external", url),

  onCalendarEvent: (callback) => {
    const listener = (_event, data) => callback(data);

    ipcRenderer.on("calendar:event", listener);

    return () => {
      ipcRenderer.removeListener(
        "calendar:event",
        listener
      );
    };
  },

  uploadRecording: ({
    blob,
    title,
    durationSeconds,
    appUrl,
    calendarEventId
  }) =>
    blob.arrayBuffer().then((buffer) =>
      ipcRenderer.invoke("recording:upload", {
        buffer,
        title,
        durationSeconds,
        appUrl,
        calendarEventId
      })
    )
});
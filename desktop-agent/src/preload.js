// The only bridge between the UI and the main process. Every call returns a value or throws a readable error.
const { contextBridge, ipcRenderer } = require("electron");

async function call(channel, ...args) {
  const result = await ipcRenderer.invoke(channel, ...args);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function subscribe(channel) {
  return (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  };
}

contextBridge.exposeInMainWorld("tally", {
  auth: {
    state: () => call("auth:state"),
    begin: () => call("auth:begin"),
    cancel: () => call("auth:cancel"),
    submitCode: (code) => call("auth:code", code),
    signOut: () => call("auth:signOut"),
    onChanged: subscribe("auth:changed"),
    onError: subscribe("auth:error")
  },
  events: {
    list: (sync) => call("events:list", sync),
    onChanged: subscribe("events:changed"),
    onJoin: subscribe("events:join")
  },
  recordings: {
    list: () => call("recordings:list"),
    onChanged: subscribe("recordings:changed"),
    start: (details) => call("recording:start", details),
    chunk: (id, kind, data) => ipcRenderer.send("recording:chunk", { id, kind, data }),
    rename: (id, title) => call("recording:rename", { id, title }),
    finish: (id, durationSeconds, timing) => call("recording:finish", { id, durationSeconds, ...timing }),
    retry: (id) => call("recording:retry", id),
    discard: (id) => call("recording:discard", id)
  },
  open: {
    meeting: (meetingId) => call("open:meeting", meetingId),
    app: (pathname) => call("open:app", pathname),
    external: (url) => call("open:external", url)
  },
  calls: {
    current: () => call("call:current"),
    onDetected: subscribe("call:detected"),
    onRecord: subscribe("call:record")
  },
  settings: {
    get: () => call("settings:get"),
    set: (patch) => call("settings:set", patch)
  },
  calendar: {
    connect: () => call("calendar:connect"),
    onConnected: subscribe("calendar:connected")
  },
  onTrayCommand: subscribe("tray:command")
});

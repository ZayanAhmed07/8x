/* global tally, TallyCapture */
const AudioCapture = window.TallyCapture.Capture;
const listMicrophones = window.TallyCapture.microphones;

const state = {
  view: "loading", // loading | signedOut | waiting | home | recording
  user: null,
  calendarConnected: true,
  events: [],
  recordings: [],
  mics: [],
  micId: localStorage.getItem("micId") || "",
  title: "",
  error: "",
  menuOpen: false,
  busy: false,
  rec: null, // { id, title, startedAt, pausedTotal, pausedAt, hasSystem }
  call: null, // a Meet/Zoom/Teams window the main process spotted
  settings: { remindMinutes: 2, nudgeAtStart: true },
  connectingCalendar: false
};
let capture = null;
let timer = null;

// ---------- tiny DOM helper (no innerHTML, so nothing from the network is ever parsed as HTML) ----------

function h(tag, props, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith("on")) element.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === "className") element.className = value;
    else if (key === "value") element.value = value;
    else element.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat()) if (child !== null && child !== undefined && child !== false) element.append(child.nodeType ? child : String(child));
  return element;
}

const initials = (name) => (name || "?").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
const clock = (seconds) => `${Math.floor(seconds / 3600) ? `${Math.floor(seconds / 3600)}:` : ""}${String(Math.floor((seconds % 3600) / 60)).padStart(Math.floor(seconds / 3600) ? 2 : 1, "0")}:${String(seconds % 60).padStart(2, "0")}`;
const timeOf = (iso) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();
const dayOf = (iso) => (isToday(iso) ? "Today" : new Date(iso).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }));

function set(patch) {
  Object.assign(state, patch);
  render();
}

async function attempt(fn) {
  try { set({ error: "" }); return await fn(); } catch (error) { set({ error: error.message, busy: false }); return undefined; }
}

// ---------- views ----------

function header() {
  return h("header", { className: "header" },
    h("span", { className: "brand" }, h("img", { src: "../assets/icon.png", alt: "" }), "Tally Capture"),
    h("span", { className: "spacer" }),
    state.user && h("div", { className: "account" },
      h("button", { className: "avatar", title: state.user.email, "aria-label": "Account", onClick: () => set({ menuOpen: !state.menuOpen }) }, initials(state.user.name || state.user.email)),
      state.menuOpen && h("div", { className: "menu", role: "menu" },
        h("div", { className: "who" }, h("strong", {}, state.user.name), h("span", {}, state.user.email)),
        h("button", { role: "menuitem", onClick: () => { set({ menuOpen: false }); tally.open.app("/meetings"); } }, "Open Tally"),
        h("button", { role: "menuitem", onClick: () => { set({ menuOpen: false }); tally.open.app("/settings#devices"); } }, "Manage devices"),
        h("button", { role: "menuitem", disabled: Boolean(state.rec), onClick: signOut }, "Sign out"))));
}

function welcome() {
  return h("div", { className: "welcome" },
    h("img", { src: "../assets/icon.png", alt: "" }),
    h("h1", { className: "serif" }, "Record meetings without a bot."),
    h("ul", { className: "points" },
      h("li", {}, "Records your mic and your computer’s audio separately, so the transcript knows who said what."),
      h("li", {}, "The recap, decisions and who owes what land in Tally a few minutes after you stop."),
      h("li", {}, "Nothing is recorded until you press Record.")),
    state.error && h("p", { className: "error", role: "alert" }, state.error),
    h("button", { className: "button primary wide", onClick: () => attempt(async () => { await tally.auth.begin(); set({ view: "waiting" }); }) }, "Sign in with your browser"),
    h("p", { className: "faint fine" }, "You’ll approve this app in Tally with your Google or email account."));
}

function waiting() {
  const code = h("input", { className: "input", id: "code", placeholder: "XXXX-XXXX-XXXX", maxlength: "20", "aria-label": "Sign-in code", onKeydown: (event) => { if (event.key === "Enter") submitCode(); } });
  async function submitCode() {
    if (!code.value.trim()) return;
    set({ busy: true });
    await attempt(() => tally.auth.submitCode(code.value));
    set({ busy: false });
  }
  return h("div", { className: "welcome" },
    h("div", { className: "spinner", "aria-hidden": "true" }),
    h("h1", { className: "serif h-small" }, "Finish signing in in your browser"),
    h("p", { className: "muted" }, "Approve Tally Capture in the tab that just opened. This window picks it up automatically."),
    h("button", { className: "button", onClick: () => attempt(() => tally.auth.begin()) }, "Open the browser again"),
    h("div", { className: "divider" }, "or enter the code from the browser"),
    h("div", { className: "code-row" }, code, h("button", { className: "button primary", disabled: state.busy, onClick: submitCode }, "Continue")),
    state.error && h("p", { className: "error", role: "alert" }, state.error),
    h("button", { className: "button link", onClick: () => attempt(async () => { await tally.auth.cancel(); set({ view: "signedOut" }); }) }, "Cancel"));
}

function nextEvent() {
  const now = Date.now();
  return state.events.find((event) => Date.parse(event.endTime) > now && Date.parse(event.startTime) - now < 15 * 60 * 1000);
}

function home() {
  const upcoming = nextEvent();
  const titleInput = h("input", { className: "input", id: "title", value: state.title, placeholder: upcoming?.title || "Untitled meeting", "aria-label": "Meeting title", onInput: (event) => { state.title = event.target.value; } });
  const micSelect = h("select", { className: "input", "aria-label": "Microphone", onChange: (event) => { state.micId = event.target.value; localStorage.setItem("micId", state.micId); } },
    h("option", { value: "" }, "Default microphone"),
    ...state.mics.filter((mic) => mic.deviceId !== "default").map((mic) => h("option", { value: mic.deviceId, selected: mic.deviceId === state.micId }, mic.label || "Microphone")));

  return h("div", { className: "scroll" },
    state.call && h("section", { className: "detected", "aria-label": "Call detected" },
      h("span", { className: "pulse" }),
      h("div", {}, h("strong", {}, `${state.call.app} call detected`), h("div", { className: "sub" }, state.call.title)),
      h("button", { className: "button small primary", disabled: state.busy, onClick: () => startRecording({ title: state.call.title, calendarEventId: state.call.calendarEventId ?? undefined }) }, "Record this call")),
    h("section", { className: "card record-card", "aria-label": "New recording" },
      h("label", { className: "field" }, "Meeting", titleInput),
      h("label", { className: "field" }, "Microphone", micSelect),
      state.error && h("p", { className: "error", role: "alert" }, state.error),
      h("button", { className: "record-button", disabled: state.busy, onClick: () => startRecording({ title: state.title.trim() || upcoming?.title, calendarEventId: !state.title.trim() ? upcoming?.id : undefined }) }, h("i"), state.busy ? "Starting…" : "Start recording"),
      h("p", { className: "hint" }, "Saves to ", h("strong", { className: "account-email" }, state.user?.email ?? "your workspace"), ". Headphones give the cleanest transcript.")),

    h("div", { className: "section-row" },
      h("h2", { className: "section-title" }, "Up next"),
      state.calendarConnected && h("label", { className: "reminder" }, "Remind me",
        h("select", { "aria-label": "Reminder", onChange: (event) => tally.settings.set({ remindMinutes: Number(event.target.value) }).then((settings) => set({ settings })) },
          [[0, "off"], [1, "1 min before"], [2, "2 min before"], [5, "5 min before"], [10, "10 min before"]].map(([value, label]) => h("option", { value: String(value), selected: state.settings.remindMinutes === value }, label))))),
    !state.calendarConnected
      ? h("div", { className: "callout" }, "Connect Google Calendar in Tally to see your calls here and get a reminder before each one.", h("div", {}, h("button", { className: "button small", disabled: state.connectingCalendar, onClick: async () => { set({ connectingCalendar: true }); await tally.calendar.connect(); } }, state.connectingCalendar ? "Waiting for Google…" : "Connect Google Calendar")))
      : state.events.length === 0
        ? h("div", { className: "callout" }, "No Google Meet calls in the next two weeks.")
        : h("div", { className: "list" }, state.events.slice(0, 5).map((event) => {
            const live = event.state === "live";
            return h("div", { className: "row" },
              h("span", { className: `when${live ? " now" : ""}` }, live ? "NOW" : timeOf(event.startTime)),
              h("div", {}, h("div", { className: "title" }, event.title), h("div", { className: "sub" }, `${dayOf(event.startTime)} · ${event.attendeeCount || 1} ${event.attendeeCount === 1 ? "person" : "people"}`)),
              h("div", { className: "actions" }, h("button", { className: "button small", disabled: state.busy, onClick: () => startRecording({ title: event.title, calendarEventId: event.id, meetUrl: event.meetUrl }) }, "Join & record")));
          })),

    state.recordings.length > 0 && h("h2", { className: "section-title" }, "Recent"),
    state.recordings.length > 0 && h("div", { className: "list" }, state.recordings.map(recentRow)));
}

function recentRow(item) {
  const done = item.uploaded?.length ?? 0;
  const total = item.uploadsPrepared?.length ?? item.tracks?.length ?? 3;
  const status = {
    recording: ["Recording", "busy"],
    saved: ["Not uploaded", ""],
    uploading: [`Uploading ${Math.min(done + 1, total)}/${total}`, "busy"],
    processing: ["Transcribing", "busy"],
    ready: ["Ready", "ready"],
    failed: ["Failed", "failed"]
  }[item.status] ?? [item.status, ""];
  // Once the audio is in Tally it is deleted here, so only local recordings can be retried.
  const canRetry = ["saved", "failed"].includes(item.status) && !item.audioDeleted;
  return h("div", { className: "row recent" },
    h("div", {}, h("div", { className: "title" }, item.title), h("div", { className: "sub" }, `${dayOf(item.startedAt)} ${timeOf(item.startedAt)} · ${clock(item.durationSeconds || 0)}`)),
    h("div", { className: "actions" },
      h("span", { className: `status ${status[1]}` }, status[0]),
      item.status === "ready" && item.meetingId && h("button", { className: "button small", onClick: () => tally.open.meeting(item.meetingId) }, "Open"),
      canRetry && h("button", { className: "button small", onClick: () => tally.recordings.retry(item.id) }, item.status === "saved" ? "Upload" : "Retry"),
      ["saved", "failed"].includes(item.status) && h("button", { className: "button small link", title: "Delete this recording from this computer", onClick: () => { if (confirm(`Delete “${item.title}” from this computer? This can’t be undone.`)) tally.recordings.discard(item.id); } }, "Delete")),
    item.error && item.status !== "ready" && h("p", { className: "error-text" }, item.error));
}

function recording() {
  const rec = state.rec;
  const title = h("input", { className: "input", id: "live-title", value: rec.title, "aria-label": "Meeting title", onChange: (event) => { rec.title = event.target.value; tally.recordings.rename(rec.id, rec.title); } });
  return h("div", { className: "scroll" }, h("div", { className: "live" },
    h("div", { className: `live-top${rec.pausedAt ? " paused" : ""}` }, h("i"), rec.pausedAt ? "Paused" : "Recording"),
    h("div", { className: "timer", id: "timer" }, clock(elapsedSeconds())),
    h("label", { className: "field" }, "Meeting", title),
    h("div", { className: "meters" },
      h("div", { className: "meter you" }, h("span", {}, state.user?.name || "You"), h("span", { className: "state" }, "Microphone"), h("div", { className: "bar" }, h("i", { id: "level-you" }))),
      rec.hasSystem
        ? h("div", { className: "meter" }, h("span", {}, "Others on the call"), h("span", { className: "state" }, "Computer audio"), h("div", { className: "bar" }, h("i", { id: "level-others" })))
        : h("p", { className: "warning" }, "Only your microphone is being recorded. Windows didn’t allow capturing the computer’s audio, so other people may be quiet in the transcript.")),
    state.call?.app === "Google Meet" && h("p", { className: state.call.names ? "names-on" : "hint" }, state.call.names ? "Tally for Meet is adding speakers’ real names from Meet’s captions." : "Install Tally for Meet in Chrome to get real names instead of “Others on the call”."),
    state.error && h("p", { className: "error", role: "alert" }, state.error),
    h("div", { className: "live-actions" },
      h("button", { className: "button tall", onClick: togglePause }, rec.pausedAt ? "Resume" : "Pause"),
      h("button", { className: "stop-button", disabled: state.busy, onClick: stopRecording }, h("i"), state.busy ? "Saving…" : "Stop & upload")),
    h("p", { className: "hint" }, "Saved to this computer every few seconds. If anything goes wrong, the recording is still here.")));
}

function render() {
  const active = document.activeElement;
  const focusId = active?.id;
  const selection = focusId && "selectionStart" in active ? [active.selectionStart, active.selectionEnd] : null;
  const root = document.getElementById("app");
  const view = { loading: () => h("div", { className: "welcome" }, h("div", { className: "spinner" })), signedOut: welcome, waiting, home, recording }[state.view]();
  root.replaceChildren(...(["home", "recording"].includes(state.view) ? [header(), view] : [view]));
  if (focusId) {
    const again = document.getElementById(focusId);
    if (again) { again.focus(); if (selection && again.setSelectionRange) again.setSelectionRange(...selection); }
  }
}

// ---------- recording ----------

function elapsedSeconds() {
  const rec = state.rec;
  if (!rec) return 0;
  const now = rec.pausedAt ?? Date.now();
  return Math.max(0, Math.floor((now - rec.startedAt - rec.pausedTotal) / 1000));
}

async function startRecording({ title, calendarEventId, meetUrl }) {
  if (state.rec || state.busy) return;
  set({ busy: true, error: "" });
  if (meetUrl) tally.open.external(meetUrl);
  let manifest;
  try {
    manifest = await tally.recordings.start({ title: title || "Untitled meeting", calendarEventId });
    capture = new AudioCapture({
      onChunk: (kind, data) => tally.recordings.chunk(manifest.id, kind, data),
      onLevels: ({ you, others }) => {
        const youBar = document.getElementById("level-you");
        const othersBar = document.getElementById("level-others");
        if (youBar) youBar.style.width = `${Math.round(you * 100)}%`;
        if (othersBar && others !== null) othersBar.style.width = `${Math.round(others * 100)}%`;
      }
    });
    await capture.start(state.micId);
  } catch (error) {
    if (manifest) await tally.recordings.discard(manifest.id).catch(() => undefined);
    await capture?.stop().catch(() => undefined);
    capture = null;
    const denied = /Permission|NotAllowed|NotFound/i.test(`${error.name} ${error.message}`);
    return set({ busy: false, error: denied ? "Tally Capture can’t use your microphone. Allow it in Windows Settings → Privacy & security → Microphone." : error.message });
  }
  state.mics = await listMicrophones();
  set({ busy: false, title: "", view: "recording", rec: { id: manifest.id, title: manifest.title, startedAt: Date.now(), pausedTotal: 0, pausedAt: null, pauses: [], hasSystem: capture.hasSystemAudio } });
  timer = setInterval(() => { const node = document.getElementById("timer"); if (node) node.textContent = clock(elapsedSeconds()); }, 500);
}

function togglePause() {
  const rec = state.rec;
  if (!rec || !capture) return;
  if (rec.pausedAt) { rec.pauses.push({ startMs: rec.pausedAt, endMs: Date.now() }); rec.pausedTotal += Date.now() - rec.pausedAt; rec.pausedAt = null; capture.resume(); }
  else { rec.pausedAt = Date.now(); capture.pause(); }
  render();
}

async function stopRecording() {
  const rec = state.rec;
  if (!rec || !capture || state.busy) return;
  set({ busy: true });
  const seconds = elapsedSeconds();
  clearInterval(timer);
  await capture.stop().catch(() => undefined);
  capture = null;
  if (rec.pausedAt) rec.pauses.push({ startMs: rec.pausedAt, endMs: Date.now() });
  await attempt(() => tally.recordings.finish(rec.id, seconds, { startedAtMs: rec.startedAt, pauses: rec.pauses }));
  set({ busy: false, rec: null, view: "home" });
}

// ---------- session ----------

async function loadSignedIn(auth) {
  set({ view: state.rec ? "recording" : "home", user: auth.user, calendarConnected: auth.calendarConnected !== false });
  const [recordings, mics] = await Promise.all([tally.recordings.list().catch(() => []), listMicrophones()]);
  set({ recordings, mics, call: await tally.calls.current().catch(() => null), settings: await tally.settings.get().catch(() => state.settings) });
  tally.events.list(true).then((events) => set({ events })).catch((error) => { if (/calendar/i.test(error.message)) set({ calendarConnected: false }); });
}

async function signOut() {
  set({ menuOpen: false });
  await attempt(() => tally.auth.signOut());
  set({ view: "signedOut", user: null, events: [], recordings: [] });
}

tally.auth.onChanged((auth) => { if (auth.signedIn) loadSignedIn(auth); else if (!state.rec) set({ view: "signedOut", user: null }); });
tally.auth.onError((message) => set({ error: message }));
tally.events.onChanged((events) => set({ events }));
tally.events.onJoin((event) => { if (state.view === "home") startRecording({ title: event.title, calendarEventId: event.id, meetUrl: event.meetUrl }); });
tally.recordings.onChanged((recordings) => set({ recordings }));
tally.calls.onDetected((call) => set({ call }));
tally.calendar.onConnected(() => set({ calendarConnected: true, connectingCalendar: false }));
tally.calls.onRecord((call) => { if (state.view === "home") startRecording({ title: call.title, calendarEventId: call.calendarEventId ?? undefined }); });
tally.onTrayCommand((command) => {
  if (command === "stop") stopRecording();
  if (command === "start" && state.view === "home") startRecording({ title: state.title.trim() || nextEvent()?.title });
});
navigator.mediaDevices.addEventListener("devicechange", async () => set({ mics: await listMicrophones() }));
document.addEventListener("click", (event) => { if (state.menuOpen && !event.target.closest(".account")) set({ menuOpen: false }); });

(async () => {
  render();
  const auth = await tally.auth.state().catch(() => ({ signedIn: false }));
  if (auth.signedIn) loadSignedIn(auth);
  else set({ view: auth.waitingForBrowser ? "waiting" : "signedOut" });
})();

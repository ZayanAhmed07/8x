const STORAGE_KEY = "fathom-capture-agent";
const state = { sources: [], events: [], selectedEvent: null, recorder: null, chunks: [], startedAt: 0, timer: null, stream: null };
const els = {
  appUrl: document.getElementById("appUrl"), agentToken: document.getElementById("agentToken"), title: document.getElementById("title"), meetUrl: document.getElementById("meetUrl"), openMeet: document.getElementById("openMeet"), events: document.getElementById("events"), loadEvents: document.getElementById("loadEvents"), sources: document.getElementById("sources"), preview: document.getElementById("preview"), help: document.getElementById("help"), idle: document.getElementById("idle"), recording: document.getElementById("recording"), uploading: document.getElementById("uploading"), refresh: document.getElementById("refresh"), record: document.getElementById("record"), stop: document.getElementById("stop"), elapsed: document.getElementById("elapsed"), uploadMessage: document.getElementById("uploadMessage"), dashboard: document.getElementById("dashboard"), statusText: document.getElementById("statusText"), statusDot: document.getElementById("statusDot")
};
function setStatus(label, recording = false) { els.statusText.textContent = label; els.statusDot.classList.toggle("recording", recording); }
function show(name) { for (const key of ["idle", "recording", "uploading"]) els[key].classList.toggle("hidden", key !== name); }
function saveSettings() { localStorage.setItem(STORAGE_KEY, JSON.stringify({ appUrl: els.appUrl.value })); }
function loadSettings() { try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); if (saved.appUrl) els.appUrl.value = saved.appUrl; } catch { } }
function setError(message) { els.help.textContent = message; setStatus("Needs attention"); show("idle"); }
function formatElapsed(seconds) { return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }
function appendText(parent, text, className) { const node = document.createElement("div"); if (className) node.className = className; node.textContent = text; parent.appendChild(node); return node; }
function selectEvent(event) { state.selectedEvent = event; els.title.value = event?.title || "Captured meeting"; els.meetUrl.textContent = event?.meetUrl || ""; els.openMeet.classList.toggle("hidden", !event?.meetUrl); els.help.textContent = event ? `${event.state}: ${event.title}` : "Choose a source, then Record."; setStatus(event ? "Meeting set" : "Ready"); }
function renderEvents() {
  els.events.replaceChildren();
  if (!state.events.length) { appendText(els.events, "No paired Google Meet events loaded.", "small"); return; }
  state.events.forEach((event, index) => {
    const row = document.createElement("div"); row.className = "event-row";
    const meta = document.createElement("div"); appendText(meta, event.title || "Untitled meeting", "event-title"); appendText(meta, `${new Date(event.startTime).toLocaleString()} · ${event.state}`, "small");
    const button = document.createElement("button"); button.type = "button"; button.className = "select-event"; button.textContent = "Select"; button.addEventListener("click", () => selectEvent(state.events[index]));
    row.append(meta, button); els.events.appendChild(row);
  });
}
async function loadEvents() {
  saveSettings(); els.loadEvents.disabled = true; setStatus("Syncing");
  try { const data = await window.captureAgent.getEvents({ appUrl: els.appUrl.value, token: els.agentToken.value }); state.events = data.events || []; renderEvents(); if (!state.selectedEvent && state.events[0]) selectEvent(state.events[0]); else setStatus("Ready"); }
  catch (error) { setError(error instanceof Error ? error.message : "Could not load meetings."); }
  finally { els.loadEvents.disabled = false; }
}
async function loadSources() {
  els.refresh.disabled = true;
  try { state.sources = await window.captureAgent.getSources(); els.sources.replaceChildren(...state.sources.map((source) => { const option = document.createElement("option"); option.value = source.id; option.textContent = source.name; return option; })); updatePreview(); }
  catch (error) { setError(error instanceof Error ? error.message : "Could not load sources."); }
  finally { els.refresh.disabled = false; }
}
function updatePreview() { const source = state.sources.find((item) => item.id === els.sources.value) ?? state.sources[0]; els.preview.src = source?.thumbnail ?? ""; }
async function getMixedStream(sourceId) { const desktopStream = await navigator.mediaDevices.getUserMedia({ audio: { mandatory: { chromeMediaSource: "desktop" } }, video: { mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: sourceId } } }); let micStream = null; try { micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); } catch { micStream = null; } const audioContext = new AudioContext(); const destination = audioContext.createMediaStreamDestination(); for (const stream of [desktopStream, micStream].filter(Boolean)) { if (stream.getAudioTracks().length > 0) audioContext.createMediaStreamSource(stream).connect(destination); } return new MediaStream([...desktopStream.getVideoTracks(), ...destination.stream.getAudioTracks()]); }
async function startRecording() { try { saveSettings(); const sourceId = els.sources.value; if (!sourceId) return setError("Choose a source before recording."); state.stream = await getMixedStream(sourceId); state.chunks = []; state.startedAt = Date.now(); state.recorder = new MediaRecorder(state.stream, { mimeType: "video/webm" }); state.recorder.ondataavailable = (event) => { if (event.data.size > 0) state.chunks.push(event.data); }; state.recorder.onstop = uploadRecording; state.recorder.start(1000); state.timer = setInterval(() => { els.elapsed.textContent = formatElapsed(Math.floor((Date.now() - state.startedAt) / 1000)); }, 250); els.help.textContent = `Recording ${els.title.value}.`; setStatus("Recording", true); show("recording"); } catch (error) { setError(error instanceof Error ? error.message : "Could not start recording."); } }
function stopRecording() { if (!state.recorder) return; state.recorder.stop(); clearInterval(state.timer); state.stream?.getTracks().forEach((track) => track.stop()); els.help.textContent = "Uploading recording."; setStatus("Uploading"); show("uploading"); }
async function uploadRecording() { const blob = new Blob(state.chunks, { type: "video/webm" }); const durationSeconds = Math.max(1, Math.round((Date.now() - state.startedAt) / 1000)); try { const result = await window.captureAgent.uploadRecording({ blob, title: els.title.value, durationSeconds, appUrl: els.appUrl.value, token: els.agentToken.value, calendarEventId: state.selectedEvent?.id }); const href = `${els.appUrl.value.replace(/\/$/, "")}/meetings/${result.meetingId}`; els.dashboard.href = href; els.dashboard.classList.remove("hidden"); els.uploadMessage.textContent = "Uploaded. The meeting is ready in your dashboard."; els.help.textContent = "Capture uploaded successfully."; setStatus("Uploaded"); } catch (error) { setError(error instanceof Error ? error.message : "Upload failed."); } }
els.refresh.addEventListener("click", loadSources); els.loadEvents.addEventListener("click", loadEvents); els.appUrl.addEventListener("change", saveSettings); els.agentToken.addEventListener("change", saveSettings); els.openMeet.addEventListener("click", () => { if (state.selectedEvent?.meetUrl) window.captureAgent.openExternal(state.selectedEvent.meetUrl); }); els.sources.addEventListener("change", updatePreview); els.record.addEventListener("click", startRecording); els.stop.addEventListener("click", stopRecording); window.captureAgent.onCalendarEvent((event) => { if (event) selectEvent(event); });
loadSettings(); loadSources(); setInterval(() => { if (els.agentToken.value) loadEvents(); }, 120000);

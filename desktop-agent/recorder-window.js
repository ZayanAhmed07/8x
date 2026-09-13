const state = { sources: [], recorder: null, chunks: [], startedAt: 0, timer: null, stream: null };

const els = {
  appUrl: document.getElementById("appUrl"),
  title: document.getElementById("title"),
  sources: document.getElementById("sources"),
  preview: document.getElementById("preview"),
  help: document.getElementById("help"),
  idle: document.getElementById("idle"),
  recording: document.getElementById("recording"),
  uploading: document.getElementById("uploading"),
  refresh: document.getElementById("refresh"),
  record: document.getElementById("record"),
  stop: document.getElementById("stop"),
  elapsed: document.getElementById("elapsed"),
  uploadMessage: document.getElementById("uploadMessage"),
  dashboard: document.getElementById("dashboard")
};

function show(name) {
  for (const key of ["idle", "recording", "uploading"]) els[key].classList.toggle("hidden", key !== name);
}

function setError(message) {
  els.help.textContent = message;
  show("idle");
}

function formatElapsed(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

async function loadSources() {
  state.sources = await window.captureAgent.getSources();
  els.sources.innerHTML = state.sources.map((source) => `<option value="${source.id}">${source.name}</option>`).join("");
  updatePreview();
}

function updatePreview() {
  const source = state.sources.find((item) => item.id === els.sources.value) ?? state.sources[0];
  els.preview.src = source?.thumbnail ?? "";
}

async function getMixedStream(sourceId) {
  const desktopStream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: "desktop" } },
    video: { mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: sourceId } }
  });

  let micStream = null;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch {
    micStream = null;
  }

  const audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();
  for (const stream of [desktopStream, micStream].filter(Boolean)) {
    if (stream.getAudioTracks().length > 0) {
      audioContext.createMediaStreamSource(stream).connect(destination);
    }
  }

  return new MediaStream([...desktopStream.getVideoTracks(), ...destination.stream.getAudioTracks()]);
}

async function startRecording() {
  try {
    const sourceId = els.sources.value;
    if (!sourceId) return setError("Choose a source before recording.");
    state.stream = await getMixedStream(sourceId);
    state.chunks = [];
    state.startedAt = Date.now();
    state.recorder = new MediaRecorder(state.stream, { mimeType: "video/webm" });
    state.recorder.ondataavailable = (event) => { if (event.data.size > 0) state.chunks.push(event.data); };
    state.recorder.onstop = uploadRecording;
    state.recorder.start(1000);
    state.timer = setInterval(() => { els.elapsed.textContent = formatElapsed(Math.floor((Date.now() - state.startedAt) / 1000)); }, 250);
    els.help.textContent = "Recording screen, system audio, and microphone.";
    show("recording");
  } catch (error) {
    setError(error instanceof Error ? error.message : "Could not start recording.");
  }
}

function stopRecording() {
  if (!state.recorder) return;
  state.recorder.stop();
  clearInterval(state.timer);
  state.stream?.getTracks().forEach((track) => track.stop());
  els.help.textContent = "Uploading recording.";
  show("uploading");
}

async function uploadRecording() {
  const blob = new Blob(state.chunks, { type: "video/webm" });
  const durationSeconds = Math.max(1, Math.round((Date.now() - state.startedAt) / 1000));
  try {
    const result = await window.captureAgent.uploadRecording({ blob, title: els.title.value, durationSeconds, appUrl: els.appUrl.value });
    const href = `${els.appUrl.value.replace(/\/$/, "")}/meetings/${result.meetingId}`;
    els.dashboard.href = href;
    els.dashboard.classList.remove("hidden");
    els.uploadMessage.textContent = "Uploaded. The meeting is ready in your dashboard.";
  } catch (error) {
    setError(error instanceof Error ? error.message : "Upload failed.");
  }
}

els.refresh.addEventListener("click", loadSources);
els.sources.addEventListener("change", updatePreview);
els.record.addEventListener("click", startRecording);
els.stop.addEventListener("click", stopRecording);
loadSources().catch((error) => setError(error instanceof Error ? error.message : "Could not load sources."));

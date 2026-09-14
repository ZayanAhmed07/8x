const STORAGE_KEY = "fathom-capture-agent";

const state = {
  authenticated: false,
  accountEmail: "",
  sources: [],
  events: [],
  selectedEvent: null,
  recorder: null,
  chunks: [],
  startedAt: 0,
  timer: null,
  stream: null
};

const els = {
  loginPanel: document.getElementById("loginPanel"),
  connectionPanel: document.getElementById("connectionPanel"),
  capturePanel: document.getElementById("capturePanel"),

  loginAppUrl: document.getElementById("loginAppUrl"),
  loginEmail: document.getElementById("loginEmail"),
  loginPassword: document.getElementById("loginPassword"),
  loginButton: document.getElementById("loginButton"),
  loginError: document.getElementById("loginError"),

  accountEmail: document.getElementById("accountEmail"),
  logoutButton: document.getElementById("logoutButton"),

  appUrl: document.getElementById("appUrl"),
  title: document.getElementById("title"),
  meetUrl: document.getElementById("meetUrl"),
  openMeet: document.getElementById("openMeet"),
  events: document.getElementById("events"),
  loadEvents: document.getElementById("loadEvents"),
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
  dashboard: document.getElementById("dashboard"),
  statusText: document.getElementById("statusText"),
  statusDot: document.getElementById("statusDot")
};

function setStatus(label, recording = false) {
  els.statusText.textContent = label;
  els.statusDot.classList.toggle("recording", recording);
}

function showCaptureState(name) {
  for (const key of ["idle", "recording", "uploading"]) {
    els[key].classList.toggle("hidden", key !== name);
  }
}

function saveSettings() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      appUrl: els.appUrl.value,
      accountEmail: state.accountEmail
    })
  );
}

function loadSettings() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "{}"
    );

    if (saved.appUrl) {
      els.appUrl.value = saved.appUrl;
      els.loginAppUrl.value = saved.appUrl;
    }

    if (saved.accountEmail) {
      state.accountEmail = saved.accountEmail;
    }
  } catch {
    // Ignore invalid local settings.
  }
}

function showLogin() {
  state.authenticated = false;

  els.loginPanel.classList.remove("hidden");
  els.connectionPanel.classList.add("hidden");
  els.capturePanel.classList.add("hidden");

  els.loginPassword.value = "";
  els.loginError.textContent = "";

  setStatus("Signed out");
  els.help.textContent = "Sign in to connect your meetings.";
}

function showAuthenticated() {
  state.authenticated = true;

  els.loginPanel.classList.add("hidden");
  els.connectionPanel.classList.remove("hidden");
  els.capturePanel.classList.remove("hidden");

  els.accountEmail.textContent =
    state.accountEmail || "Signed-in account";

  els.help.textContent =
    "Choose a meeting and source, then start a manual capture.";

  setStatus("Connected");
}

function setError(message) {
  els.help.textContent = message;
  setStatus("Needs attention");
  showCaptureState("idle");
}

function formatElapsed(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60
  ).padStart(2, "0")}`;
}

function appendText(parent, text, className) {
  const node = document.createElement("div");

  if (className) {
    node.className = className;
  }

  node.textContent = text;
  parent.appendChild(node);

  return node;
}

function selectEvent(event) {
  state.selectedEvent = event;

  els.title.value = event?.title || "Captured meeting";
  els.meetUrl.textContent = event?.meetUrl || "";

  els.openMeet.classList.toggle(
    "hidden",
    !event?.meetUrl
  );

  els.help.textContent = event
    ? `${event.state}: ${event.title}`
    : "Choose a source, then Record.";

  setStatus(event ? "Meeting set" : "Connected");
}

function renderEvents() {
  els.events.replaceChildren();

  if (!state.events.length) {
    appendText(
      els.events,
      "No Google Meet events loaded.",
      "small"
    );
    return;
  }

  state.events.forEach((event, index) => {
    const row = document.createElement("div");
    row.className = "event-row";

    const meta = document.createElement("div");

    appendText(
      meta,
      event.title || "Untitled meeting",
      "event-title"
    );

    appendText(
      meta,
      `${new Date(event.startTime).toLocaleString()} · ${
        event.state
      }`,
      "small"
    );

    const button = document.createElement("button");
    button.type = "button";
    button.className = "select-event";
    button.textContent = "Select";

    button.addEventListener("click", () => {
      selectEvent(state.events[index]);
    });

    row.append(meta, button);
    els.events.appendChild(row);
  });
}

async function loadEvents() {
  if (!state.authenticated) {
    return;
  }

  saveSettings();
  els.loadEvents.disabled = true;
  setStatus("Syncing");

  try {
    const data = await window.captureAgent.getEvents({
      appUrl: els.appUrl.value
    });

    state.events = data.events || [];
    renderEvents();

    if (!state.selectedEvent && state.events[0]) {
      selectEvent(state.events[0]);
    } else {
      setStatus("Connected");
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not load meetings.";

    setError(message);

    if (
      message.toLowerCase().includes("not signed in") ||
      message.toLowerCase().includes("not paired") ||
      message.toLowerCase().includes("401")
    ) {
      showLogin();
    }
  } finally {
    els.loadEvents.disabled = false;
  }
}

async function signIn() {
  const appUrl = els.loginAppUrl.value.trim();
  const email = els.loginEmail.value.trim();
  const password = els.loginPassword.value;

  els.loginButton.disabled = true;
  els.loginError.textContent = "";
  els.help.textContent = "Signing in...";
  setStatus("Signing in");

  try {
    const result = await window.captureAgent.login({
      appUrl,
      email,
      password
    });

    state.accountEmail = result.email || email;
    els.appUrl.value = appUrl;

    saveSettings();
    showAuthenticated();

    await loadSources();
    await loadEvents();
  } catch (error) {
    els.loginError.textContent =
      error instanceof Error
        ? error.message
        : "Sign in failed.";

    els.help.textContent = "Check your credentials and try again.";
    setStatus("Sign-in failed");
  } finally {
    els.loginButton.disabled = false;
  }
}

async function signOut() {
  if (state.recorder) {
    state.recorder.stop();
  }

  state.stream?.getTracks().forEach((track) => {
    track.stop();
  });

  state.authenticated = false;
  state.events = [];
  state.selectedEvent = null;

  await window.captureAgent.logout();

  showLogin();
}

async function loadSources() {
  if (!state.authenticated) {
    return;
  }

  els.refresh.disabled = true;

  try {
    state.sources = await window.captureAgent.getSources();

    els.sources.replaceChildren(
      ...state.sources.map((source) => {
        const option = document.createElement("option");
        option.value = source.id;
        option.textContent = source.name;
        return option;
      })
    );

    updatePreview();
  } catch (error) {
    setError(
      error instanceof Error
        ? error.message
        : "Could not load sources."
    );
  } finally {
    els.refresh.disabled = false;
  }
}

function updatePreview() {
  const source =
    state.sources.find(
      (item) => item.id === els.sources.value
    ) || state.sources[0];

  els.preview.src = source?.thumbnail || "";
}

async function getMixedStream(sourceId) {
  const desktopStream =
    await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "desktop"
        }
      },
      video: {
        mandatory: {
          chromeMediaSource: "desktop",
          chromeMediaSourceId: sourceId
        }
      }
    });

  let micStream = null;

  try {
    micStream =
      await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });
  } catch {
    micStream = null;
  }

  const audioContext = new AudioContext();
  const destination =
    audioContext.createMediaStreamDestination();

  for (const stream of [desktopStream, micStream].filter(
    Boolean
  )) {
    if (stream.getAudioTracks().length > 0) {
      audioContext
        .createMediaStreamSource(stream)
        .connect(destination);
    }
  }

  return new MediaStream([
    ...desktopStream.getVideoTracks(),
    ...destination.stream.getAudioTracks()
  ]);
}

async function startRecording() {
  try {
    if (!state.authenticated) {
      return showLogin();
    }

    saveSettings();

    const sourceId = els.sources.value;

    if (!sourceId) {
      return setError(
        "Choose a source before recording."
      );
    }

    state.stream = await getMixedStream(sourceId);
    state.chunks = [];
    state.startedAt = Date.now();

    state.recorder = new MediaRecorder(
      state.stream,
      {
        mimeType: "video/webm"
      }
    );

    state.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        state.chunks.push(event.data);
      }
    };

    state.recorder.onstop = uploadRecording;
    state.recorder.start(1000);

    state.timer = setInterval(() => {
      els.elapsed.textContent = formatElapsed(
        Math.floor(
          (Date.now() - state.startedAt) / 1000
        )
      );
    }, 250);

    els.help.textContent =
      `Recording ${els.title.value}.`;

    setStatus("Recording", true);
    showCaptureState("recording");
  } catch (error) {
    setError(
      error instanceof Error
        ? error.message
        : "Could not start recording."
    );
  }
}

function stopRecording() {
  if (!state.recorder) {
    return;
  }

  state.recorder.stop();

  clearInterval(state.timer);

  state.stream?.getTracks().forEach((track) => {
    track.stop();
  });

  els.help.textContent = "Uploading recording.";
  setStatus("Uploading");
  showCaptureState("uploading");
}

async function uploadRecording() {
  const blob = new Blob(state.chunks, {
    type: "video/webm"
  });

  const durationSeconds = Math.max(
    1,
    Math.round(
      (Date.now() - state.startedAt) / 1000
    )
  );

  try {
    const result =
      await window.captureAgent.uploadRecording({
        blob,
        title: els.title.value,
        durationSeconds,
        appUrl: els.appUrl.value,
        calendarEventId: state.selectedEvent?.id
      });

    const href = `${els.appUrl.value.replace(
      /\/$/,
      ""
    )}/meetings/${result.meetingId}`;

    els.dashboard.href = href;
    els.dashboard.classList.remove("hidden");

    els.uploadMessage.textContent =
      "Uploaded. The meeting is ready in your dashboard.";

    els.help.textContent =
      "Capture uploaded successfully.";

    setStatus("Uploaded");
  } catch (error) {
    setError(
      error instanceof Error
        ? error.message
        : "Upload failed."
    );
  }
}

async function initialize() {
  loadSettings();

  try {
    const session =
      await window.captureAgent.getSession();

    if (!session?.authenticated) {
      showLogin();
      return;
    }

    state.authenticated = true;
    showAuthenticated();

    await loadSources();
    await loadEvents();
  } catch (error) {
    showLogin();

    els.loginError.textContent =
      error instanceof Error
        ? error.message
        : "Could not restore your session.";
  }
}

els.loginButton.addEventListener("click", signIn);

els.loginPassword.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    signIn();
  }
});

els.logoutButton.addEventListener("click", signOut);

els.refresh.addEventListener("click", loadSources);
els.loadEvents.addEventListener("click", loadEvents);

els.appUrl.addEventListener("change", () => {
  els.loginAppUrl.value = els.appUrl.value;
  saveSettings();
});

els.openMeet.addEventListener("click", () => {
  if (state.selectedEvent?.meetUrl) {
    window.captureAgent.openExternal(
      state.selectedEvent.meetUrl
    );
  }
});

els.sources.addEventListener("change", updatePreview);
els.record.addEventListener("click", startRecording);
els.stop.addEventListener("click", stopRecording);

window.captureAgent.onCalendarEvent((event) => {
  if (event) {
    selectEvent(event);
  }
});

initialize();

setInterval(() => {
  if (state.authenticated) {
    loadEvents();
  }
}, 120000);
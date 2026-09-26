const DOWNLOAD = "https://github.com/ZayanAhmed07/Tally/releases/latest/download/Tally-Capture-Setup.exe";

function check(ok, title, detail) {
  const item = document.createElement("li");
  item.className = ok === null ? "idle" : ok ? "ok" : "warn";
  const strong = document.createElement("strong");
  strong.textContent = title;
  const span = document.createElement("span");
  span.textContent = detail;
  item.append(strong, span);
  return item;
}

function render(status) {
  const checks = document.getElementById("checks");
  checks.replaceChildren(
    check(status.desktop, status.desktop ? "Tally Capture is running" : "Tally Capture isn't running", status.desktop ? (status.signedIn === false ? "Open it and sign in." : "Speaker names are sent to it, on this computer only.") : "Open the desktop app. Names are queued until it is."),
    check(status.inCall ? true : null, status.inCall ? `In a call: ${status.title}` : "Not in a Meet call", status.inCall ? (status.captions ? `Reading names from captions${status.speakers?.length ? ` · ${status.speakers.length} people seen` : ""}` : "Waiting for captions to turn on.") : "Join a call in this browser."),
    check(status.recording ? true : status.inCall ? false : null, status.recording ? "Recording" : "Not recording", status.recording ? (status.recordingTitle || "Names will be added to this recording.") : status.inCall ? "Press Record in Tally Capture to capture this call." : "")
  );
  const footer = document.getElementById("footer");
  footer.replaceChildren();
  if (!status.desktop) {
    const link = document.createElement("a");
    link.href = DOWNLOAD;
    link.target = "_blank";
    link.textContent = "Get Tally Capture";
    footer.append(link);
  }
}

chrome.storage.sync.get({ autoCaptions: true, hideCaptions: false }, (settings) => {
  for (const key of ["autoCaptions", "hideCaptions"]) {
    const box = document.getElementById(key);
    box.checked = settings[key];
    box.addEventListener("change", () => chrome.storage.sync.set({ [key]: box.checked }));
  }
});

chrome.runtime.sendMessage({ type: "status" }, render);

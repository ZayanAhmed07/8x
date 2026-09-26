// Tally for Meet: watches a Google Meet call and reports who is speaking, and when.
// Meet's live captions label each line with the speaker's name, which is the most
// reliable signal available, so this reads the caption area rather than Meet's
// scrambled class names. Nothing here leaves your computer except through Tally Capture.

const MEET_CODE = /^\/([a-z]{3}-[a-z]{4}-[a-z]{3})(?:$|[/?#])/i;
const REPORT_MS = 2000;
const REASSERT_MS = 15000; // re-send the current speaker during long monologues

let settings = { autoCaptions: true, hideCaptions: false };
let captionsRequested = false;
let current = { name: "", at: 0, text: "" };
let pending = [];
let names = new Set();
let wasInCall = false;

chrome.storage.sync.get(settings, (stored) => { settings = { ...settings, ...stored }; applyHide(); });
chrome.storage.onChanged.addListener((changes) => {
  for (const [key, change] of Object.entries(changes)) settings[key] = change.newValue;
  applyHide();
});

function meetingCode() {
  return location.pathname.match(MEET_CODE)?.[1]?.toLowerCase() ?? "";
}

/** In a call when the "Leave call" button exists (not on the green-room page). */
function inCall() {
  return Boolean(meetingCode() && document.querySelector('[aria-label*="Leave call" i], [aria-label*="leave call" i]'));
}

function meetingTitle() {
  const tagged = document.querySelector("[data-meeting-title]")?.getAttribute("data-meeting-title");
  if (tagged) return tagged.trim();
  const fromTab = document.title.replace(/^Meet\s*[-–]\s*/i, "").trim();
  return fromTab && fromTab.toLowerCase() !== "meet" ? fromTab : meetingCode();
}

function participantNames() {
  for (const element of document.querySelectorAll("[data-self-name]")) {
    const name = element.getAttribute("data-self-name")?.trim();
    if (name && name.length < 60) names.add(name);
  }
  return [...names];
}

function captionsRegion() {
  return document.querySelector('[role="region"][aria-label*="aption" i]');
}

function turnOnCaptions() {
  if (!settings.autoCaptions || captionsRequested || captionsRegion()) return;
  const button = [...document.querySelectorAll("button")].find((element) => /turn on captions/i.test(element.getAttribute("aria-label") || ""));
  if (button) { button.click(); captionsRequested = true; }
}

/** The newest caption block: the speaker's name on the first line, their words after it. */
function latestCaption(region) {
  const avatars = region.querySelectorAll("img");
  let block = avatars[avatars.length - 1]?.parentElement ?? null;
  while (block && block !== region && !(block.innerText || "").includes("\n")) block = block.parentElement;
  const lines = ((block ?? region).innerText || "").split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2 || lines[0].length > 60) return null;
  return { name: lines[0], text: lines.slice(1).join(" ") };
}

function readCaptions() {
  const region = captionsRegion();
  if (!region) return;
  const caption = latestCaption(region);
  if (!caption) return;
  const now = Date.now();
  const grew = caption.text !== current.text;
  if (caption.name !== current.name || (grew && now - current.at > REASSERT_MS)) {
    pending.push({ t: now, name: caption.name });
    current = { name: caption.name, at: now, text: caption.text };
    if (caption.name !== "You") names.add(caption.name);
  } else if (grew) {
    current.text = caption.text;
  }
}

function applyHide() {
  let style = document.getElementById("tally-hide-captions");
  if (settings.hideCaptions && !style) {
    style = document.createElement("style");
    style.id = "tally-hide-captions";
    // Kept in the page (so it keeps updating) but invisible.
    style.textContent = '[role="region"][aria-label*="aption" i] { opacity: 0 !important; pointer-events: none !important; }';
    document.documentElement.append(style);
  } else if (!settings.hideCaptions && style) {
    style.remove();
  }
}

let scheduled = false;
new MutationObserver(() => {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => { scheduled = false; if (inCall()) readCaptions(); }, 200);
}).observe(document.documentElement, { subtree: true, childList: true, characterData: true });

function report(state) {
  const events = pending.splice(0);
  const message = { type: "meet", state, code: meetingCode(), title: meetingTitle(), participants: participantNames(), captions: Boolean(captionsRegion()), events };
  // After an extension update the old content script loses its connection; drop quietly.
  try { chrome.runtime.sendMessage(message).catch(() => undefined); } catch { /* extension reloaded */ }
}

setInterval(() => {
  const live = inCall();
  if (live) { turnOnCaptions(); report("in-call"); }
  else if (wasInCall) { report("left"); current = { name: "", at: 0, text: "" }; names = new Set(); captionsRequested = false; }
  wasInCall = live;
}, REPORT_MS);

window.addEventListener("pagehide", () => { if (wasInCall) report("left"); });

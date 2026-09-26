// Relays what the Meet tab sees to Tally Capture on this computer (a local-only connection).
// Speaker events are queued while the desktop app is closed, so a late start loses nothing.
const DESKTOP = "http://127.0.0.1:47821";
const MAX_QUEUE = 5000;

let status = { desktop: false, recording: false, recordingTitle: "", inCall: false, title: "", captions: false, speakers: [], checkedAt: 0 };
let queue = [];

function badge() {
  const text = !status.desktop ? "!" : status.recording ? "REC" : "";
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: status.recording ? "#D92D20" : "#8A857A" });
}

async function send(body) {
  try {
    const response = await fetch(`${DESKTOP}/v1/meet`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    status = { ...status, desktop: true, recording: Boolean(data.recording), recordingTitle: data.title || "" };
    return true;
  } catch {
    status = { ...status, desktop: false, recording: false };
    return false;
  } finally {
    status.checkedAt = Date.now();
    badge();
  }
}

chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message.type === "meet") {
    queue.push(...message.events);
    if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
    status = { ...status, inCall: message.state === "in-call", title: message.title, captions: message.captions, speakers: message.participants };
    const events = queue;
    queue = [];
    send({ ...message, events }).then((ok) => { if (!ok) queue = [...events, ...queue]; });
    return false;
  }
  if (message.type === "status") {
    // Refresh the desktop check when the popup opens.
    fetch(`${DESKTOP}/v1/status`).then((response) => response.json()).then((data) => {
      status = { ...status, desktop: true, recording: Boolean(data.recording), recordingTitle: data.title || "", signedIn: data.signedIn };
    }).catch(() => { status = { ...status, desktop: false }; }).finally(() => { badge(); reply(status); });
    return true;
  }
  return false;
});

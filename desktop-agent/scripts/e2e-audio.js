// Dev-only: builds a realistic two-person test recording without a microphone.
// 1. Windows text-to-speech says each person's lines on their own track, with silence while the other talks.
// 2. Chromium's MediaRecorder (the same encoder the app uses) turns each track into WebM/Opus,
//    plus a mix of both, exactly the files Tally Capture uploads.
// Run: npx electron scripts/e2e-audio.js <outDir>
const { app, BrowserWindow, ipcMain } = require("electron");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const outDir = path.resolve(process.argv[2] || path.join(__dirname, "..", ".e2e"));
fs.mkdirSync(outDir, { recursive: true });

const conversation = [
  ["you", "Thanks for joining. Quick one today: are we still on track to ship the invoice export on Friday?"],
  ["them", "Mostly. The CSV part is done, but the PDF layout still breaks on long vendor names."],
  ["you", "Okay. Can you fix the layout by Thursday so we can test it before the release?"],
  ["them", "Yes, I'll fix the PDF layout by Thursday. I'll also send you the test file with long names today."],
  ["you", "Great. Then the decision is: we ship on Friday if the PDF test passes on Thursday. I'll tell the customer success team."],
  ["them", "Sounds good. Talk Thursday."]
];
const SECONDS_PER_WORD = 0.42;

function ssml(role) {
  const parts = conversation.map(([who, text]) => who === role ? `<s>${text}</s><break time="600ms"/>` : `<break time="${Math.round(text.split(" ").length * SECONDS_PER_WORD * 1000 + 600)}ms"/>`);
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><prosody rate="0%">${parts.join("")}</prosody></speak>`;
}

function speak(role, voice) {
  const file = path.join(outDir, `${role}.wav`);
  const ssmlFile = path.join(outDir, `${role}.ssml`);
  fs.writeFileSync(ssmlFile, ssml(role));
  execFileSync("powershell", ["-NoProfile", "-Command", `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SelectVoice('${voice}'); $s.SetOutputToWaveFile('${file}'); $s.SpeakSsml([IO.File]::ReadAllText('${ssmlFile}')); $s.Dispose()`]);
  return file;
}

app.whenReady().then(async () => {
  const you = speak("you", "Microsoft Zira Desktop");
  const them = speak("them", "Microsoft Hazel Desktop");
  const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true, contextIsolation: false, autoplayPolicy: "no-user-gesture-required" } });
  ipcMain.on("done", (_event, files) => {
    for (const [name, bytes] of Object.entries(files)) fs.writeFileSync(path.join(outDir, name), Buffer.from(bytes));
    console.log(JSON.stringify(Object.fromEntries(Object.keys(files).map((name) => [name, fs.statSync(path.join(outDir, name)).size]))));
    app.quit();
  });
  ipcMain.on("fail", (_event, message) => { console.error(message); app.exit(1); });
  await win.loadURL("data:text/html,<html></html>");
  await win.webContents.executeJavaScript(`(async () => {
    const { ipcRenderer } = require("electron");
    const fs = require("fs");
    try {
      const context = new AudioContext();
      const load = async (file) => context.decodeAudioData(fs.readFileSync(file).buffer.slice(0));
      const [you, them] = await Promise.all([load(${JSON.stringify(you)}), load(${JSON.stringify(them)})]);
      const mix = context.createMediaStreamDestination();
      const track = (buffer) => { const destination = context.createMediaStreamDestination(); const source = context.createBufferSource(); source.buffer = buffer; source.connect(destination); source.connect(mix); return { source, stream: destination.stream }; };
      const a = track(you), b = track(them);
      const record = (stream, bits) => { const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: bits }); const chunks = []; recorder.ondataavailable = (e) => chunks.push(e.data); const done = new Promise((r) => recorder.onstop = () => r(new Blob(chunks).arrayBuffer())); recorder.start(1000); return { recorder, done }; };
      const recs = { "mic.webm": record(a.stream, 32000), "system.webm": record(b.stream, 32000), "mix.webm": record(mix.stream, 48000) };
      a.source.start(); b.source.start();
      await new Promise((r) => setTimeout(r, Math.max(you.duration, them.duration) * 1000 + 500));
      for (const { recorder } of Object.values(recs)) recorder.stop();
      const out = {};
      for (const [name, { done }] of Object.entries(recs)) out[name] = new Uint8Array(await done);
      ipcRenderer.send("done", out);
    } catch (error) { ipcRenderer.send("fail", String(error)); }
  })()`);
});

(() => {
// Captures three audio streams:
//   mic    - your microphone (you)
//   system - the computer's audio via loopback (everyone else on the call)
//   mix    - both together, for playback in Tally
// Separate tracks are what let Tally label who said what without guessing.
// Chunks go to the main process every few seconds and are written to disk immediately.

const CHUNK_MS = 5000;
const VOICE = { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 32000 };
const MIX = { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 48000 };

function levelOf(analyser, buffer) {
  analyser.getFloatTimeDomainData(buffer);
  let sum = 0;
  for (const sample of buffer) sum += sample * sample;
  return Math.min(1, Math.sqrt(sum / buffer.length) * 4);
}

class Capture {
  constructor({ onChunk, onLevels }) {
    this.onChunk = onChunk;
    this.onLevels = onLevels;
    this.recorders = {};
    this.pending = new Set();
    this.streams = [];
  }

  async start(micDeviceId) {
    const mic = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: micDeviceId ? { exact: micDeviceId } : undefined, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    this.streams.push(mic);

    // Loopback audio arrives attached to a screen capture; the picture is never recorded.
    let system = null;
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: { frameRate: 1, width: 320, height: 180 } });
      this.streams.push(display);
      const track = display.getAudioTracks()[0];
      if (track) system = new MediaStream([track]);
    } catch {
      system = null;
    }
    this.hasSystemAudio = Boolean(system);

    this.context = new AudioContext();
    const mixDestination = this.context.createMediaStreamDestination();
    const analyse = (stream) => {
      const source = this.context.createMediaStreamSource(stream);
      const analyser = this.context.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      source.connect(mixDestination);
      return analyser;
    };
    const micAnalyser = analyse(mic);
    const systemAnalyser = system ? analyse(system) : null;

    this.record("mic", mic, VOICE);
    if (system) this.record("system", system, VOICE);
    this.record("mix", mixDestination.stream, MIX);

    const buffer = new Float32Array(1024);
    const tick = () => {
      if (!this.context) return;
      this.onLevels({ you: levelOf(micAnalyser, buffer), others: systemAnalyser ? levelOf(systemAnalyser, buffer) : null });
      this.frame = requestAnimationFrame(tick);
    };
    tick();
  }

  record(kind, stream, options) {
    const recorder = new MediaRecorder(stream, MediaRecorder.isTypeSupported(options.mimeType) ? options : { audioBitsPerSecond: options.audioBitsPerSecond });
    recorder.ondataavailable = (event) => {
      if (!event.data.size) return;
      const work = event.data.arrayBuffer().then((data) => this.onChunk(kind, data));
      this.pending.add(work);
      work.finally(() => this.pending.delete(work));
    };
    recorder.start(CHUNK_MS);
    this.recorders[kind] = recorder;
  }

  pause() { for (const recorder of Object.values(this.recorders)) if (recorder.state === "recording") recorder.pause(); }
  resume() { for (const recorder of Object.values(this.recorders)) if (recorder.state === "paused") recorder.resume(); }

  /** Stops every recorder and waits until the last chunk has been handed to the main process. */
  async stop() {
    await Promise.all(Object.values(this.recorders).map((recorder) => new Promise((resolve) => {
      if (recorder.state === "inactive") return resolve();
      recorder.addEventListener("stop", resolve, { once: true });
      recorder.stop();
    })));
    await Promise.all([...this.pending]);
    cancelAnimationFrame(this.frame);
    for (const stream of this.streams) for (const track of stream.getTracks()) track.stop();
    await this.context?.close();
    this.context = null;
  }
}

async function microphones() {
  const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
  return devices.filter((device) => device.kind === "audioinput" && device.deviceId !== "communications");
}
window.TallyCapture = { Capture, microphones };
})();

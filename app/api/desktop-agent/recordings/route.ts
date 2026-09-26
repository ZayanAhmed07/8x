import { NextResponse } from "next/server";
import { jsonError, requireAgent } from "@/lib/api/agent";
import { MAX_FILE_BYTES, newRecordingId, signUploads } from "@/lib/recordings";

// Tally Capture records audio as separate tracks: your microphone, the computer's
// audio (everyone else), and a mix for playback. Separate tracks give real speaker labels.
const TRACKS = new Set(["mic", "system", "mix"]);

/** Step 1: reserve a meeting id and a signed upload URL per track. */
export async function POST(request: Request) {
  const agent = await requireAgent(request);
  if ("response" in agent) return agent.response;
  const body = await request.json().catch(() => null);
  const tracks: { kind: string; size: number }[] = Array.isArray(body?.tracks) ? body.tracks : [];
  if (!tracks.some((track) => track.kind === "mix") || tracks.some((track) => !TRACKS.has(track.kind) || !(Number(track.size) > 0))) return jsonError("The recording has no audio.");
  if (tracks.some((track) => track.size > MAX_FILE_BYTES)) return jsonError("This recording is too large to upload (over 50 MB per track).", 413);
  const meetingId = newRecordingId();
  try {
    const uploads = await signUploads(agent.userId, meetingId, tracks.map((track) => `${track.kind}.webm`));
    return NextResponse.json({ meetingId, uploads: uploads.map((upload) => ({ ...upload, kind: upload.name.replace(".webm", "") })) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Couldn't prepare the upload.", 502);
  }
}

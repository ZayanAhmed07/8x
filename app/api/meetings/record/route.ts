import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { newRecordingId, signUploads } from "@/lib/recordings";

// Browser uploads go straight to storage; Whisper takes up to 25 MB per file.
const MAX_BYTES = 25 * 1024 * 1024;
const EXTENSIONS = new Set(["webm", "mp4", "m4a", "mp3", "wav", "ogg"]);

/** Step 1: reserve a meeting id and a signed upload URL. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to upload." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const extension = String(body?.fileName ?? "").toLowerCase().split(".").pop() ?? "";
  const size = Number(body?.size);
  if (!EXTENSIONS.has(extension)) return NextResponse.json({ error: "Use a .webm, .mp4, .m4a, .mp3, .ogg or .wav file." }, { status: 400 });
  if (!(size > 0) || size > MAX_BYTES) return NextResponse.json({ error: "Recordings must be 25 MB or smaller. Audio files fit about an hour." }, { status: 413 });
  const meetingId = newRecordingId();
  try {
    const [upload] = await signUploads(user.id, meetingId, [`upload.${extension}`]);
    return NextResponse.json({ meetingId, signedUrl: upload.signedUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Couldn't prepare the upload." }, { status: 502 });
  }
}

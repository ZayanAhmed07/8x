import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isRecordingId, objectPath, startProcessing, uploadedFiles } from "@/lib/recordings";

export const maxDuration = 300;

/** Step 2: the file is in storage. Create the meeting and transcribe it in the background. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [user, { id }] = await Promise.all([getCurrentUser(), params]);
  if (!user) return NextResponse.json({ error: "Sign in to upload." }, { status: 401 });
  if (!isRecordingId(id)) return NextResponse.json({ error: "Unknown upload." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const name = [...(await uploadedFiles(user.id, id))].find((file) => file.startsWith("upload."));
  if (!name) return NextResponse.json({ error: "The upload didn't finish. Try again." }, { status: 409 });
  const audio = /\.(m4a|mp3|wav|ogg)$/.test(name) || String(body.contentType ?? "").startsWith("audio/");
  await startProcessing({
    userId: user.id,
    meetingId: id,
    title: typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 120) : "Uploaded meeting",
    durationSeconds: Number(body.durationSeconds) || 1,
    media: { name, kind: audio ? "audio" : "video" },
    tracks: [{ objectPath: objectPath(user.id, id, name), speakerName: "Speaker", contentType: String(body.contentType || "application/octet-stream") }]
  });
  return NextResponse.json({ meetingId: id, status: "processing" }, { status: 202 });
}

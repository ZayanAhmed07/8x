import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Recordings live in a private bucket. Meetings store a storage:// reference and
// pages resolve it to a short-lived signed URL when they render.
export const RECORDINGS_BUCKET = "recordings";
const PREFIX = `storage://${RECORDINGS_BUCKET}/`;
const READ_TTL_SECONDS = 60 * 60 * 6;

let client: SupabaseClient | undefined;

export function storageClient() {
  if (client) return client;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase storage is not configured.");
  client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export const storageRef = (objectPath: string) => `${PREFIX}${objectPath}`;
export const isStorageRef = (value: string) => value.startsWith(PREFIX);
export const objectPathOf = (ref: string) => ref.slice(PREFIX.length);

/** Turns a storage:// reference into something a <video>/<audio> element can play. Other URLs pass through. */
export async function playableUrl(value: string) {
  if (!value || !isStorageRef(value)) return value;
  const { data, error } = await storageClient().storage.from(RECORDINGS_BUCKET).createSignedUrl(objectPathOf(value), READ_TTL_SECONDS);
  return error ? "" : data.signedUrl;
}

export async function download(objectPath: string) {
  const { data, error } = await storageClient().storage.from(RECORDINGS_BUCKET).download(objectPath);
  if (error || !data) throw new Error(`Couldn't read ${objectPath}: ${error?.message ?? "missing"}`);
  return data;
}

/** "Maya Chen" from profile metadata, else a readable form of the email's local part. */
export async function displayNameFor(userId: string) {
  const { data } = await storageClient().auth.admin.getUserById(userId);
  const meta = data.user?.user_metadata ?? {};
  const name = [meta.full_name, meta.name].find((value) => typeof value === "string" && value.trim());
  if (name) return String(name).trim().slice(0, 60);
  const local = (data.user?.email ?? "You").split("@")[0].replace(/[._-]+/g, " ").trim();
  return local.replace(/\b\w/g, (letter) => letter.toUpperCase()) || "You";
}

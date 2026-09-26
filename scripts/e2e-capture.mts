// Dev-only end-to-end check of the Tally Capture server flow (code exchange, upload, processing), as the demo user.
// Make test audio first: cd desktop-agent && npx electron scripts/e2e-audio.js <dir>. Then: npx tsx scripts/e2e-capture.mts <dir>. Re-run npm run seed afterwards.
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) { const i = line.indexOf("="); if (i > 0 && !line.startsWith("#")) process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim().replace(/^['"]|['"]$/g, ""); }
const { createAuthCode } = await import("../lib/desktop-auth");
const { getDb } = await import("../lib/db/client");
const { sql } = await import("drizzle-orm");
const BASE = "http://localhost:3000";
const DIR = process.argv[2];

const [{ id: demoId }] = await getDb().execute<{ id: string }>(sql`select id from auth.users where email = 'demo@fathom8x.app'`);
const state = randomBytes(24).toString("base64url");
const code = await createAuthCode(demoId, state);            // what /desktop/connect does after "Connect"
const call = async (path: string, init: RequestInit & { token?: string } = {}) => {
  const response = await fetch(`${BASE}${path}`, { ...init, headers: { "content-type": "application/json", ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) } });
  return { status: response.status, body: await response.json().catch(() => null) };
};

const bad = await call("/api/desktop-agent/exchange", { method: "POST", body: JSON.stringify({ code, state: state.replace(/.$/, "x"), deviceName: "e2e" }) });
console.log("exchange with wrong state:", bad.status, bad.body?.error);
const exchanged = await call("/api/desktop-agent/exchange", { method: "POST", body: JSON.stringify({ code, state, deviceName: "E2E test runner" }) });
console.log("exchange:", exchanged.status, exchanged.body?.user);
const replay = await call("/api/desktop-agent/exchange", { method: "POST", body: JSON.stringify({ code, state, deviceName: "e2e" }) });
console.log("replayed code:", replay.status, replay.body?.error);
const token = exchanged.body.token;
console.log("me:", (await call("/api/desktop-agent/me", { token })).body);

const files = ["mic", "system", "mix"].map((kind) => ({ kind, bytes: readFileSync(`${DIR}/${kind}.webm`) }));
const prepared = await call("/api/desktop-agent/recordings", { method: "POST", token, body: JSON.stringify({ tracks: files.map((file) => ({ kind: file.kind, size: file.bytes.length })) }) });
console.log("prepare:", prepared.status, prepared.body?.meetingId);
const early = await call(`/api/desktop-agent/recordings/${prepared.body.meetingId}`, { method: "POST", token, body: "{}" });
console.log("finalize before upload:", early.status, early.body?.error);
for (const upload of prepared.body.uploads) {
  const put = await fetch(upload.signedUrl, { method: "PUT", headers: { "content-type": "audio/webm", "x-upsert": "true" }, body: files.find((file) => file.kind === upload.kind)!.bytes });
  console.log(`put ${upload.kind}:`, put.status);
}
const finalized = await call(`/api/desktop-agent/recordings/${prepared.body.meetingId}`, { method: "POST", token, body: JSON.stringify({ title: "Invoice export check-in", startedAt: new Date().toISOString(), durationSeconds: 40, ...(process.env.WITH_NAMES ? { speakerTimeline: { startedAtMs: 1_000_000, pauses: [], events: [{ t: 1_026_000, name: "Priya Raman" }, { t: 1_070_000, name: "Sam Whitaker" }] } } : {}) }) });
console.log("finalize:", finalized.status, finalized.body);
const t0 = Date.now();
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 3000));
  const { body } = await call(`/api/desktop-agent/recordings/${prepared.body.meetingId}`, { token });
  if (body?.status !== "processing") { console.log(`status after ${Math.round((Date.now() - t0) / 1000)}s:`, body?.status); break; }
}
const rows = await getDb().execute<{ start_ms: number; name: string; text: string }>(sql`select t.start_ms, s.name, t.text from transcript_segments t join speakers s on s.id = t.speaker_id where t.meeting_id = ${prepared.body.meetingId} order by t.start_ms`);
for (const row of rows) console.log(`  ${(row.start_ms / 1000).toFixed(1)}s ${row.name}: ${row.text}`);
const [summary] = await getDb().execute<{ content_json: unknown }>(sql`select content_json from summaries where meeting_id = ${prepared.body.meetingId}`);
console.log("summary:", JSON.stringify(summary?.content_json, null, 1)?.slice(0, 1500));
console.log("actions:", JSON.stringify(await getDb().execute(sql`select owner, text, due_date, source_segment_id from action_items where meeting_id = ${prepared.body.meetingId}`)));
console.log("chapters:", JSON.stringify(await getDb().execute(sql`select title, start_ms from chapters where meeting_id = ${prepared.body.meetingId} order by start_ms`)));
console.log("signout:", (await call("/api/desktop-agent/me", { method: "DELETE", token })).body, "then me:", (await call("/api/desktop-agent/me", { token })).status);
console.log("MEETING", prepared.body.meetingId);
process.exit(0);

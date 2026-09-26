import { randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { hashToken } from "@/lib/crypto";
import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

// Browser sign-in for Tally Capture:
// 1. The app opens /desktop/connect?state=<random> in the user's browser.
// 2. The signed-in user approves; we mint a one-time code bound to that state and
//    hand it back through the tally-capture:// link (or show it to paste).
// 3. The app exchanges code + state for a long-lived device token over HTTPS.
// Codes live 5 minutes, are single-use, and only their hashes are stored.

const CODE_TTL_MS = 5 * 60 * 1000;
export const DESKTOP_PROTOCOL = "tally-capture";

export function isValidState(state: unknown): state is string {
  return typeof state === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(state);
}

export async function createAuthCode(userId: string, state: string) {
  // Short enough to type if the deep link doesn't open, long enough not to guess within 5 minutes.
  const code = randomBytes(6).toString("hex").toUpperCase().match(/.{4}/g)!.join("-");
  await getDb().insert(schema.desktopAuthCodes).values({ id: randomUUID(), userId, codeHash: hashToken(normalizeCode(code)), state, expiresAt: new Date(Date.now() + CODE_TTL_MS) });
  return code;
}

export function normalizeCode(code: string) {
  return code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export async function exchangeAuthCode(code: string, state: string, deviceName: string) {
  const db = getDb();
  const [row] = await db
    .update(schema.desktopAuthCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(schema.desktopAuthCodes.codeHash, hashToken(normalizeCode(code))), eq(schema.desktopAuthCodes.state, state), isNull(schema.desktopAuthCodes.usedAt), gt(schema.desktopAuthCodes.expiresAt, new Date())))
    .returning();
  if (!row) return null;
  const token = `tca_${randomBytes(32).toString("base64url")}`;
  await db.insert(schema.desktopAgentTokens).values({ id: randomUUID(), userId: row.userId, tokenHash: hashToken(token), deviceName: deviceName.slice(0, 80) || "Desktop", createdAt: new Date() });
  return { token, userId: row.userId };
}

function bearer(header: string | null) {
  return header?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;
}

export async function revokeAgentToken(header: string | null) {
  const token = bearer(header);
  if (!token) return false;
  const rows = await getDb().update(schema.desktopAgentTokens).set({ revokedAt: new Date() }).where(and(eq(schema.desktopAgentTokens.tokenHash, hashToken(token)), isNull(schema.desktopAgentTokens.revokedAt))).returning();
  return rows.length > 0;
}

export async function listDevices(userId: string) {
  return getDb()
    .select({ id: schema.desktopAgentTokens.id, deviceName: schema.desktopAgentTokens.deviceName, createdAt: schema.desktopAgentTokens.createdAt, lastUsedAt: schema.desktopAgentTokens.lastUsedAt })
    .from(schema.desktopAgentTokens)
    .where(and(eq(schema.desktopAgentTokens.userId, userId), isNull(schema.desktopAgentTokens.revokedAt)))
    .orderBy(desc(schema.desktopAgentTokens.createdAt));
}

export async function revokeDevice(userId: string, id: string) {
  await getDb().update(schema.desktopAgentTokens).set({ revokedAt: new Date() }).where(and(eq(schema.desktopAgentTokens.id, id), eq(schema.desktopAgentTokens.userId, userId)));
}

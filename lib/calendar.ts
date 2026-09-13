import { and, eq, gte, lte } from "drizzle-orm";
import { randomBytes, randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { decryptText, encryptText, hashToken } from "@/lib/crypto";

const scope = "openid email profile https://www.googleapis.com/auth/calendar.events.readonly";
const meetPattern = /^https:\/\/meet\.google\.com\/[a-z0-9-]+/i;

export function isMeetUrl(value: unknown): value is string {
  return typeof value === "string" && meetPattern.test(value);
}

export function googleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) throw new Error("Google OAuth environment variables are not configured.");
  return { clientId, clientSecret, redirectUri };
}

export function buildGoogleAuthUrl(userId: string, state: string) {
  const { clientId, redirectUri } = googleOAuthConfig();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", `${userId}.${state}`);
  return url;
}

export async function exchangeGoogleCode(code: string) {
  const { clientId, clientSecret, redirectUri } = googleOAuthConfig();
  const body = new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" });
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) throw new Error("Google token exchange failed.");
  return response.json() as Promise<{ access_token: string; refresh_token?: string; expires_in: number }>;
}

async function refreshGoogleToken(connection: typeof schema.googleConnections.$inferSelect) {
  const { clientId, clientSecret } = googleOAuthConfig();
  const refreshToken = decryptText(connection.refreshTokenEncrypted);
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }) });
  if (!response.ok) throw new Error("Google refresh token is unavailable or revoked.");
  const data = await response.json() as { access_token: string; expires_in: number };
  const expiresAt = new Date(Date.now() + Math.max(60, data.expires_in - 60) * 1000);
  await getDb().update(schema.googleConnections).set({ accessTokenEncrypted: encryptText(data.access_token), expiresAt, error: null }).where(eq(schema.googleConnections.id, connection.id));
  return data.access_token;
}

export async function getGoogleAccessToken(userId: string) {
  const [connection] = await getDb().select().from(schema.googleConnections).where(eq(schema.googleConnections.userId, userId));
  if (!connection) throw new Error("Google Calendar is not connected.");
  if (connection.expiresAt.getTime() <= Date.now() + 60000) return refreshGoogleToken(connection);
  return decryptText(connection.accessTokenEncrypted);
}

export function extractMeetUrl(event: any) {
  if (isMeetUrl(event.hangoutLink)) return event.hangoutLink;
  const entries = event.conferenceData?.entryPoints ?? [];
  const video = entries.find((entry: any) => entry.entryPointType === "video" && isMeetUrl(entry.uri));
  return video?.uri ?? null;
}

export async function syncGoogleMeetEvents(userId: string) {
  const token = await getGoogleAccessToken(userId);
  const db = getDb();
  const timeMin = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  let pageToken: string | undefined;
  let synced = 0;

  do {
    const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("timeMin", timeMin);
    url.searchParams.set("timeMax", timeMax);
    url.searchParams.set("maxResults", "250");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error("Calendar API unavailable.");
    const data = await response.json();
    for (const event of data.items ?? []) {
      const meetUrl = extractMeetUrl(event);
      const start = event.start?.dateTime ? new Date(event.start.dateTime) : null;
      const end = event.end?.dateTime ? new Date(event.end.dateTime) : null;
      if (!event.id || !meetUrl || !start || !end) continue;
      const row = { id: `gcal-${hashToken(`${userId}:${event.id}`).slice(0, 32)}`, userId, googleEventId: event.id, title: String(event.summary || "Google Meet"), startTime: start, endTime: end, organizerEmail: event.organizer?.email ?? null, attendeeCount: Array.isArray(event.attendees) ? event.attendees.length : 0, meetUrl, updatedAt: new Date() };
      await db.insert(schema.calendarEvents).values(row).onConflictDoUpdate({ target: [schema.calendarEvents.userId, schema.calendarEvents.googleEventId], set: row });
      synced += 1;
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  await db.update(schema.googleConnections).set({ lastSyncedAt: new Date(), error: null }).where(eq(schema.googleConnections.userId, userId));
  return synced;
}

export function eventState(startTime: Date, endTime: Date) {
  const now = Date.now();
  const start = startTime.getTime();
  const end = endTime.getTime();
  if (now >= start && now <= end) return "live";
  if (now >= start - 10 * 60 * 1000 && now < start) return "starting soon";
  if (now > end && now <= end + 15 * 60 * 1000) return "recently ended";
  if (now > end) return "ended";
  return "upcoming";
}

export async function listUpcomingCalendarEvents(userId: string) {
  const rows = await getDb().select().from(schema.calendarEvents).where(and(eq(schema.calendarEvents.userId, userId), gte(schema.calendarEvents.endTime, new Date(Date.now() - 15 * 60 * 1000)), lte(schema.calendarEvents.startTime, new Date(Date.now() + 14 * 24 * 60 * 60 * 1000))));
  return rows.sort((a, b) => a.startTime.getTime() - b.startTime.getTime()).map((row) => ({ ...row, state: eventState(row.startTime, row.endTime) }));
}

export async function createAgentToken(userId: string) {
  const token = `fca_${randomBytes(32).toString("base64url")}`;
  await getDb().insert(schema.desktopAgentTokens).values({ id: randomUUID(), userId, tokenHash: hashToken(token), createdAt: new Date(), lastUsedAt: null, revokedAt: null });
  return token;
}

export async function userIdFromAgentToken(header: string | null) {
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const [row] = await getDb().select().from(schema.desktopAgentTokens).where(eq(schema.desktopAgentTokens.tokenHash, hashToken(token)));
  if (!row || row.revokedAt) return null;
  await getDb().update(schema.desktopAgentTokens).set({ lastUsedAt: new Date() }).where(eq(schema.desktopAgentTokens.id, row.id));
  return row.userId;
}
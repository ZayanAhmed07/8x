import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAgent } from "@/lib/api/agent";
import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { revokeAgentToken } from "@/lib/desktop-auth";
import { displayNameFor, storageClient } from "@/lib/storage";

/** Who the desktop app is signed in as, and whether their calendar is connected. */
export async function GET(request: Request) {
  const agent = await requireAgent(request);
  if ("response" in agent) return agent.response;
  const [{ data }, name, connections] = await Promise.all([
    storageClient().auth.admin.getUserById(agent.userId),
    displayNameFor(agent.userId),
    getDb().select({ id: schema.googleConnections.id }).from(schema.googleConnections).where(eq(schema.googleConnections.userId, agent.userId))
  ]);
  return NextResponse.json({ email: data.user?.email ?? "", name, calendarConnected: connections.length > 0 });
}

/** Signing out of the app revokes its token on the server, not just locally. */
export async function DELETE(request: Request) {
  await revokeAgentToken(request.headers.get("authorization"));
  return NextResponse.json({ signedOut: true });
}

import { cache } from "react";
import { sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db/client";

export const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL ?? "demo@fathom8x.app";

export type Viewer = {
  /** Whose rows are being read. The demo user's id when isDemo is true. */
  workspaceUserId: string;
  /** The signed-in account, if any. */
  user: { id: string; email?: string } | null;
  /** True when showing the seeded sample workspace instead of the viewer's own data. */
  isDemo: boolean;
};

let demoUserId: string | undefined;

async function getDemoUserId() {
  if (demoUserId) return demoUserId;
  const rows = await getDb().execute<{ id: string }>(sql`select id from auth.users where email = ${DEMO_USER_EMAIL} limit 1`);
  const id = rows[0]?.id;
  if (!id) throw new Error(`Demo user ${DEMO_USER_EMAIL} is missing. Run npm run seed.`);
  demoUserId = id;
  return id;
}

/**
 * Signed-out visitors see the sample workspace. Signed-in people always see their own
 * meetings, even when there are none yet: mixing in sample data made real accounts look fake.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const user = await getCurrentUser();
  if (user) return { workspaceUserId: user.id, user: { id: user.id, email: user.email }, isDemo: false };
  return { workspaceUserId: await getDemoUserId(), user: null, isDemo: true };
});

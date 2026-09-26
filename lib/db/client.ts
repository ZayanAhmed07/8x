import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

type Db = ReturnType<typeof drizzle>;

// One pool per server instance. Creating a pool per call exhausts Supabase connections on serverless.
const globalForDb = globalThis as unknown as { db?: Db };

export function getDb(): Db {
  if (globalForDb.db) return globalForDb.db;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  // prepare: false is required by the Supabase transaction pooler (port 6543).
  const client = postgres(process.env.DATABASE_URL, { prepare: false, max: 5, connect_timeout: 10 });
  globalForDb.db = drizzle(client);
  return globalForDb.db;
}

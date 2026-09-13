import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
export function getDb() { if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required"); return drizzle(postgres(process.env.DATABASE_URL)); }

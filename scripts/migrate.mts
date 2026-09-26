// Applies drizzle/*.sql in order. Every migration is idempotent, so this is safe to re-run.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import postgres from "postgres";

for (const line of existsSync(".env.local") ? readFileSync(".env.local", "utf8").split(/\r?\n/) : []) {
  const index = line.indexOf("=");
  if (index > 0 && !line.trim().startsWith("#")) process.env[line.slice(0, index).trim()] ??= line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, onnotice: () => {} });
for (const file of readdirSync("drizzle").filter((name) => name.endsWith(".sql")).sort()) {
  await sql.unsafe(readFileSync(`drizzle/${file}`, "utf8"));
  console.log(`applied ${file}`);
}
await sql.end();

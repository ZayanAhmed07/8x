import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";

export async function createClient() {
  const settings = getSupabaseConfig();
  if (!settings) throw new Error("Supabase public URL and key are not configured.");
  const store = await cookies();
  return createServerClient(settings.url, settings.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (items) => {
        // Server Components cannot write cookies. Proxy persists refreshed cookies.
        try { items.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* Read-only Server Component cookie store. */ }
      }
    }
  });
}

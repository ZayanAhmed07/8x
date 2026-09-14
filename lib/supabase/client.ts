import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";
export function createClient() {
  const settings = getSupabaseConfig();
  if (!settings) throw new Error("Supabase public URL and key are not configured.");
  return createBrowserClient(settings.url, settings.key);
}

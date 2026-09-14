import test from "node:test";
import assert from "node:assert/strict";
import { getSupabaseConfig } from "../lib/supabase/config.ts";
import { proxy } from "../proxy.ts";
import { NextRequest } from "next/server";

test("Supabase config handles missing and malformed settings and publishable keys", async () => {
 const keys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
 const original = keys.map(k => process.env[k]);
 try {
   keys.forEach(k => delete process.env[k]);
   assert.equal(getSupabaseConfig(), null);
   const response = await proxy(new NextRequest("https://fathom8x.vercel.app/meetings"));
   assert.equal(response.status, 503);
   assert.equal(response.headers.get("cache-control"), "no-store");
   process.env.NEXT_PUBLIC_SUPABASE_URL = "not-a-url";
   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
   assert.equal(getSupabaseConfig(), null);
   process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
   assert.equal(getSupabaseConfig()?.key, "test-key");
   delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
   process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
   assert.equal(getSupabaseConfig()?.key, "sb_publishable_test");
 } finally { keys.forEach((k,i) => { if(original[i] === undefined) delete process.env[k]; else process.env[k] = original[i]; }); }
});

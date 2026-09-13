import test from "node:test";
import assert from "node:assert/strict";
import { calendarCallbackMatchesSite } from "../lib/auth/calendar-callback.ts";
test("calendar callback accepts the exact local and deployed site", () => {
  for (const origin of ["http://localhost:3000", "https://fathom8x.vercel.app"]) assert.equal(calendarCallbackMatchesSite(origin + "/api/integrations/google/callback", origin), true);
});
test("calendar callback rejects wrong ports, hosts, paths and URL decorations", () => {
  for (const url of ["http://localhost:3100/api/integrations/google/callback", "http://127.0.0.1:3000/api/integrations/google/callback", "http://localhost:3000/auth/callback", "http://localhost:3000/api/integrations/google/callback/", "http://localhost:3000/api/integrations/google/callback?x=1", "http://localhost:3000/api/integrations/google/callback#test", "http://user:pass@localhost:3000/api/integrations/google/callback", "invalid"]) assert.equal(calendarCallbackMatchesSite(url, "http://localhost:3000"), false, url);
});

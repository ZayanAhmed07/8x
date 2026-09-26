CREATE TABLE IF NOT EXISTS "desktop_auth_codes" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "code_hash" text NOT NULL,
  "state" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "desktop_auth_codes_hash_idx" ON "desktop_auth_codes" ("code_hash");

-- Devices get a readable name so people can tell them apart when revoking.
ALTER TABLE "desktop_agent_tokens" ADD COLUMN IF NOT EXISTS "device_name" text;

-- "video" or "audio"; desktop captures are audio-only.
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "media_kind" text DEFAULT 'video' NOT NULL;

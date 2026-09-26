CREATE TABLE IF NOT EXISTS "action_item_mentions" (
  "id" text PRIMARY KEY NOT NULL,
  "action_item_id" text NOT NULL REFERENCES "action_items"("id") ON DELETE cascade,
  "meeting_id" text NOT NULL REFERENCES "meetings"("id") ON DELETE cascade,
  "segment_id" text NOT NULL REFERENCES "transcript_segments"("id") ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS "action_item_mentions_action_idx" ON "action_item_mentions" ("action_item_id");
CREATE INDEX IF NOT EXISTS "action_item_mentions_meeting_idx" ON "action_item_mentions" ("meeting_id");

CREATE TABLE IF NOT EXISTS public.google_connections (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text NOT NULL,
  expires_at timestamp NOT NULL,
  last_synced_at timestamp,
  error text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS google_connections_user_idx ON public.google_connections(user_id);

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_event_id text NOT NULL,
  title text NOT NULL,
  start_time timestamp NOT NULL,
  end_time timestamp NOT NULL,
  organizer_email text,
  attendee_count integer NOT NULL DEFAULT 0,
  meet_url text NOT NULL,
  meeting_id text REFERENCES public.meetings(id) ON DELETE SET NULL,
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS calendar_events_user_google_event_idx ON public.calendar_events(user_id, google_event_id);
CREATE INDEX IF NOT EXISTS calendar_events_user_time_idx ON public.calendar_events(user_id, start_time);

CREATE TABLE IF NOT EXISTS public.desktop_agent_tokens (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  last_used_at timestamp,
  revoked_at timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS desktop_agent_tokens_hash_idx ON public.desktop_agent_tokens(token_hash);
CREATE INDEX IF NOT EXISTS desktop_agent_tokens_user_idx ON public.desktop_agent_tokens(user_id);
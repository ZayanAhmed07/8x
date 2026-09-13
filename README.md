# Fathom Workspace Clone

A Next.js post-meeting workspace demo focused on the part of Fathom users live in after the call: summaries, synced transcript playback, chapter navigation, cross-meeting actions, global search, public sharing, and a seeded Ask fallback.

## Implemented

- Meeting dashboard with processing/ready states and realistic seeded meetings.
- Meeting detail workspace with video, chapter scrubber, synchronized transcript, summary templates, action items, and highlights.
- Cross-meeting action board, global search, Cmd+K command palette, public share pages, simulated upload, and simulated integrations.
- Drizzle schema and Supabase helper stubs using env var names only.

## Stubbed

Recording bot, calendar OAuth, live Zoom/Meet/Teams capture, email notifications, team permissions, and billing are intentionally simulated.

## Local Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill values as needed.
3. `npm run dev`
4. Open `http://localhost:3000/meetings`

## Env Vars

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `GROQ_API_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_DEMO_MODE`.

## Next

Connect `scripts/seed.ts` to Drizzle inserts, add persistent action toggles/highlight creation, and deploy to Vercel once credentials are available.

## Desktop Agent

The desktop agent is a separate Electron app in `desktop-agent/`. It manually captures a user-selected screen or window, system audio, and microphone audio after pressing Record, keeps the recording in memory while recording, and uploads the WebM only after pressing Stop. It does not auto-join calls, auto-start, run hidden recording, or replace the simulated meeting integrations in Settings.

Run it locally:

```bash
cd desktop-agent
npm install
npm start
```

Tier reached: Tier 1. Uploaded recordings create a ready meeting with a playable video, a "You" speaker, a placeholder transcript segment, and a general summary. Live transcription remains intentionally unimplemented.


## Google Calendar: fix redirect_uri_mismatch

Google Calendar uses its own OAuth callback, separate from Supabase Google sign-in.

1. In Google Cloud Console, open Google Auth Platform > Clients and select the Web application client matching `GOOGLE_CLIENT_ID` in your environment.
2. Under Authorized redirect URIs, add exactly `http://localhost:3000/api/integrations/google/callback` for local development. This is a redirect URI, not an Authorized JavaScript origin. Do not add a trailing slash.
3. For the deployed app, register `https://fathom8x.vercel.app/api/integrations/google/callback` if that is the deployment you are using. Set the deployment's `GOOGLE_REDIRECT_URI` to that URL. Local `.env.local` should keep the localhost URL. Restart or redeploy after changing environment variables.
4. Enable the Google Calendar API in the same project. If the OAuth app is in Testing, add the connecting Google account as a test user.
5. Open the site at the same origin and port as the configured redirect. Connect Google Calendar, choose the account, and allow read-only access. The callback performs the first sync; Settings shows a retry message if that sync fails.

The preflight checks local URL consistency. It cannot inspect Google's authorized redirect URI list. An exact local match can still be rejected by Google until step 2 is complete.

Reference: https://developers.google.com/identity/protocols/oauth2/web-server

The dashboard follows calendar setup, desktop recording, and recap review. This clone requires manual recording in Fathom Capture; it does not implement Fathom's automatic meeting attendance. Desktop installation for development is described above; no hosted installer is currently linked in the web app.

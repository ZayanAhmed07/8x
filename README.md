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

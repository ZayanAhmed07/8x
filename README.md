# Tally

Meeting notes that show their work: who owes what, and the moment they said it.

Tally started as a rebuild of [Fathom](https://fathom.ai). I kept the core loop (record, transcribe, recap, share) and rebuilt the rest around one opinion: **the recap isn't the product. What matters is whether the things people agreed to actually happen.**

## What's different from Fathom, and why

| Fathom | Tally | Why |
| --- | --- | --- |
| Action items are a list inside each meeting's summary | **Commitments** are first-class: owner, due date, and a *receipt* linking to the second it was said | "Priya will send the copy" is only useful if you can check she said Monday, not Friday |
| Each meeting stands alone | **Carry-over**: open commitments from earlier meetings appear when their owner is in the room again, with the moment they came up | This is where teams actually lose things: between meetings |
| Video-first player with a transcript beside it | **Speaker lanes**: one row per person across the whole meeting, with chapters and clips on the same timeline | On an 8-person hour you need to see who drove it and who never spoke (Owen, 3%) at a glance |
| Summary templates are fixed after the call | Switch templates, and **generate a missing one on demand**; every line cites a transcript line | Summaries you can't verify don't get trusted |
| Shared links open a video | Shared recaps are a **document for someone who wasn't there**: decisions, who owes what, clips as readable excerpts | Nobody outside the call will watch 60 minutes |

### What I cut

- **The recording bot.** Capture is a desktop app you start yourself (`desktop-agent/`), or you upload a file. A bot joining calls is the hardest part to build and the least interesting to judge.
- **The marketing site.** `/` opens the sample workspace. The product explains itself faster than a landing page.
- **Stub integrations** (Zoom, Teams, Slack, HubSpot "coming soon" cards). Only what works is shown.
- **Mock data.** Everything, including the signed-out sample workspace, is read from Postgres.

## How it works

- **Next.js 16** (App Router), **Postgres on Supabase** via Drizzle, **Supabase Auth**.
- **Sample workspace**: `npm run seed` creates a real, confirmed `demo@fathom8x.app` user who owns six meetings. Signed-out visitors, and new users with no recordings yet, see that workspace (`lib/viewer.ts`). Visitors can tick off commitments and create clips; re-running the seed resets it.
- **Seed content** (`scripts/seed-data.ts`) is written as readable scripts (`speaker: line ^tag`). Timestamps come from word counts at 150 wpm, and tags anchor every decision, commitment and clip to the exact line it came from.
- **Uploads** (`/api/meetings/record`) store the file in Supabase Storage, transcribe with Whisper on Groq, and summarise with `openai/gpt-oss-120b`.
- **Template recaps** (`lib/ai/templates.ts`) number the transcript lines and ask the model to cite line numbers, so each bullet links to the right speaker, not a guessed timestamp.
- **Ask** (`lib/ai/ask.ts`) retrieves matching transcript lines from Postgres, then answers from them and cites them. Without an API key it quotes the best match.
- Sample meetings are transcript-only, so playback runs on a transcript clock. Uploaded recordings play the real video on the same timeline.

## Run it

```bash
npm install
cp .env.example .env.local   # fill in Supabase, DATABASE_URL, GROQ_API_KEY
npm run db:migrate
npm run seed
npm run dev
```

`DATABASE_URL` should be the Supabase **transaction pooler** URL (port 6543).

## Desktop capture app (Tally Capture)

`desktop-agent/` is an Electron app. It records your microphone and your computer's audio as separate tracks, only after you press Record, and uploads them when you press Stop. You sign in through the browser; there is no URL or password field.

```bash
cd desktop-agent && npm install
npm start              # talks to https://fathom8x.vercel.app (set in package.json > tally.appUrl)
npm run start:local    # talks to http://localhost:3000
npm run dist           # builds dist/Tally-Capture-Setup.exe (branded installer)
```

**Releasing:** bump `version` in `desktop-agent/package.json`, run `npm run dist`, then create a GitHub release and attach `dist/Tally-Capture-Setup.exe` without renaming it. The website's download buttons use `/releases/latest/download/Tally-Capture-Setup.exe`, so the release marked **Latest** is always what people get. The installer isn't code-signed, so Windows SmartScreen shows "More info → Run anyway" on first install.

## Tally for Meet (Chrome extension)

`browser-extension/` gives Google Meet recordings real speaker names instead of "Others on the call".

- It reads Meet's live captions, which label every line with the speaker, and turns them on if they're off. There's an option to hide the overlay.
- It sends a "who spoke when" timeline to Tally Capture over a local-only connection (`127.0.0.1:47821`, extension origins only).
- The desktop app uploads that timeline with the recording, and the server relabels each "others" line with whoever Meet showed speaking during most of it. It allows for caption delay and paused time.

Install for development: open `chrome://extensions`, turn on Developer mode, choose **Load unpacked**, and select `browser-extension/`.

Limits: English Meet UI only (it looks for "Leave call" and "Turn on captions"), and names appear only for people who spoke while captions were on.

## Google Calendar

Calendar uses its own OAuth callback, separate from Supabase sign-in. Register `<origin>/api/integrations/google/callback` as an authorized redirect URI in Google Cloud, set `GOOGLE_REDIRECT_URI` to the same value, and enable the Calendar API. Access is read-only and used to list upcoming Google Meet calls.

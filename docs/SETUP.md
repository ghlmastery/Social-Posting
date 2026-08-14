# Setup

## 1. HighLevel (GoHighLevel) — Social Planner API access

1. In your GHL sub-account, connect Facebook, Instagram, and YouTube in
   **Marketing → Social Planner** the normal way (OAuth through their connect
   flow — this part isn't API-automatable, it's a one-time click-through per
   platform).
2. Create a **Private Integration Token**: Settings → Private Integrations →
   Create Integration. Grant these scopes:
   - `socialplanner/account.readonly`
   - `socialplanner/account.write`
   - `socialplanner/post.readonly`
   - `socialplanner/post.write`
3. Put the token in `.env` as `GHL_API_TOKEN`, and your sub-account's
   Location ID as `GHL_LOCATION_ID` (Settings → Business Info).
4. Run `npm run verify:connections`. It calls the read-only "list accounts"
   endpoint and prints each connected account's `id` and `platform`. Copy the
   right IDs into `GHL_FACEBOOK_ACCOUNT_ID`, `GHL_INSTAGRAM_ACCOUNT_ID`,
   `GHL_YOUTUBE_ACCOUNT_ID`.

**Before turning off `DRY_RUN`:** this session built `src/lib/ghlClient.ts`
from HighLevel's documented v2 API conventions, but couldn't reach
`marketplace.gohighlevel.com` to confirm the exact live `create post` request
shape (that domain is blocked from this environment's outbound network). Do
one manual test:

```bash
DRY_RUN=false npm run job:ingest   # with exactly one test video in the inbox folder
```

then check the Social Planner UI — the post should show up as scheduled/draft.
If it errors or the post looks wrong, open
`https://marketplace.gohighlevel.com/docs/ghl/social-planner/create-post/index.html`
yourself and adjust the `body` object in `createPost()` (in `src/lib/ghlClient.ts`)
to match. Everything else in the pipeline is independent of that one function.

## 2. Google (Drive + Docs)

1. Create a Google Cloud project (or reuse one) → enable the **Google Drive
   API** and **Google Docs API**.
2. Create a **Service Account**, then a JSON key for it. Note the
   `client_email` field inside the key.
3. Share these with that service-account email (Viewer is enough for the
   framework doc; Editor for the Drive folders so it can move/write files):
   - The inbox folder where you'll drop finished videos.
   - The archive folder (optional — processed videos get moved here).
   - The output folder (optional — generated idea/script docs get written here).
   - The [content framework doc](https://docs.google.com/document/d/1asmHwaH9GraMqpYWlR5BdNngAty13OU5koiZktMj8kM/edit).
4. Base64-encode the whole JSON key file and put it in
   `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`:
   ```bash
   base64 -w0 service-account.json   # macOS: base64 service-account.json | tr -d '\n'
   ```
5. Copy each folder's ID from its Drive URL
   (`drive.google.com/drive/folders/<THIS_PART>`) into `GOOGLE_DRIVE_INBOX_FOLDER_ID`
   etc. The framework doc ID is already defaulted in `.env.example` from the
   URL you gave.

**Important — how videos get posted:** the pipeline makes each new inbox
video "anyone with the link can view" (via a Drive permission) so HighLevel's
servers can fetch it by URL when publishing. If you'd rather not have videos
briefly link-public in Drive, the alternative is downloading the file locally
and using GHL's media-upload endpoint instead of a Drive URL — flag this to
whoever finishes the GHL API verification step above if it matters to you.

## 3. YouTube Data API (competitor research)

This only needs a plain **API key** (not OAuth) — it reads public search
results and stats, same as visiting YouTube directly.

1. In the same Google Cloud project, enable **YouTube Data API v3**.
2. Create an API key (restrict it to that API).
3. Put it in `YOUTUBE_API_KEY`.

## 4. Anthropic (Claude)

Put an API key in `ANTHROPIC_API_KEY`. Used for captions, daily content
ideas, and competitor script rewrites.

## 5. Fathom (call insights)

Fathom (fathom.video) call summaries feed the daily content-idea generator
with real client questions/themes from coaching and sales calls — see
`docs/ARCHITECTURE.md` for the full data flow and the privacy handling.

1. In Fathom: Settings → API Access → generate a key. No paid-tier gate as of
   this writing — available on every plan including free.
2. Put it in `FATHOM_API_KEY`.
3. Set `FATHOM_INTERNAL_EMAIL_DOMAINS` to your team's company email domain(s)
   (comma-separated, e.g. `rmmarketing.ca,ghlmastery.com`). This is the
   privacy-relevant setting: Adam's Fathom workspace doesn't currently
   separate coaching/client calls from internal meetings by team or tag, so
   this domain list is the stand-in filter — a meeting where every attendee
   is on one of these domains (or where attendee data is missing entirely)
   is treated as internal and excluded before anything reaches Claude. Leave
   it empty and every synced meeting is treated as an external client call —
   only do that if you're confident nothing purely-internal is being
   recorded in this Fathom workspace. If you later tag/folder coaching calls
   separately in Fathom, `src/lib/fathom.ts` can be tightened to filter on
   that instead of email domain (a small, contained change).
4. Run `npm run verify:connections` to confirm the key works (read-only,
   lists how many meetings exist in the last 24 hours).
5. Run `npm run job:call-insights` for a real sync, then read
   `output/call-themes-<date>.md` — check it reads as genuinely anonymized
   (no names, no company specifics) before trusting it for anything else.

**Same live-verification caveat as the GHL client:** `developers.fathom.ai`
was unreachable from this sandbox, so `src/lib/fathom.ts`'s exact endpoint
path/field names are built from search-engine snippets and third-party
integration references, not a fetched schema. It's written defensively
(tolerates a few plausible field-name variants), but if `verify:connections`
or `job:call-insights` errors or returns obviously-wrong data, check the
response shape against https://developers.fathom.ai/api-reference/ and
adjust `src/lib/fathom.ts` — same one-file fix pattern as `ghlClient.ts`.

## 6. Instagram & Facebook competitor research — why it's manual

Instagram and Facebook do not expose any public API that lets a third party
pull another account's post performance (views, likes) — that data is only
available to the account owner via their own Insights, or through paid
scraping/social-listening services (Apify, Phyllo, Social Blade, etc.),
none of which are wired up here. `npm run job:research` still gives you a
weekly manual-research checklist for those two platforms (where to look,
what to search, what signals to check) alongside the fully-automated YouTube
research. If you later get access to one of those paid data services, that's
a contained addition to `src/services/competitorResearchService.ts`.

## 7. Running it — pick one

### Option A: GitHub Actions (recommended — no server to manage)

The workflows in `.github/workflows/` already exist:
- `drive-ingest.yml` — every 20 minutes
- `call-insights.yml` — daily, 06:00 America/Toronto, an hour ahead of daily ideas
- `daily-ideas.yml` — daily
- `competitor-research.yml` — weekly (Mondays)

Add every value from `.env.example` as a **repository secret**
(Settings → Secrets and variables → Actions → Secrets) — the workflows
read `GHL_API_TOKEN`, `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`, `FATHOM_API_KEY`,
etc. from there. Non-secret tuning knobs (`POSTING_TIMEZONE`,
`POSTING_SLOT_TIMES`, `DRY_RUN`, `ANTHROPIC_MODEL`, `COMPETITOR_NICHE_KEYWORDS`,
`CONTENT_FRAMEWORK_DOC_ID`, `FATHOM_INTERNAL_EMAIL_DOMAINS`,
`FATHOM_LOOKBACK_DAYS`) can go in **Variables** instead of Secrets.

Each workflow commits `data/state.json` back to the repo after running, so
history (which videos were processed, which ideas/competitor videos were
already used) persists across runs without needing a database. Generated
idea/script markdown goes to your `GOOGLE_DRIVE_OUTPUT_FOLDER_ID`, not to git.

You can trigger any workflow immediately from the Actions tab
("Run workflow") instead of waiting for its schedule.

### Option B: Always-on process (VPS, Docker, etc.)

```bash
npm run build
npm run scheduler   # or: pm2 start dist/scheduler/index.js --name social-posting
```

This runs the same three jobs on cron schedules defined in
`src/scheduler/index.ts`, in-process, using the local `data/state.json` file
directly (no git commit step needed).

## 8. Recording workflow (the day-to-day loop)

1. `npm run job:call-insights` (or the daily Action) syncs recent Fathom
   calls into anonymized themes — run this before ideas so they're grounded
   in what clients actually asked this week.
2. `npm run job:ideas` (or let the daily Action run) drops fresh ideas,
   informed by the framework doc and those call themes — pick one, film it.
3. `npm run job:research` (or the weekly Action) gives you competitor-inspired
   scripts if you want a starting point instead of/alongside your own ideas.
4. Name the exported video file descriptively (the caption generator only
   sees the filename) and drop it in the Drive inbox folder.
5. Within 20 minutes (or on your VPS's cron tick), it's scheduled across
   Facebook, Instagram, and YouTube via the Social Planner, at the next open
   slot in `POSTING_SLOT_TIMES`.

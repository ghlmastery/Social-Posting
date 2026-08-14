# Architecture

## Data flow

```
Google Drive (inbox folder)
        │  new video file
        ▼
driveVideoIngest.ingestNewVideos()
        │  1. make file link-readable
        │  2. get next open posting slot (round-robin over POSTING_SLOT_TIMES)
        ▼
captionGenerator.generateCaptions()  ──▶  Claude: filename ──▶ {facebook, instagram, youtube} captions/title
        │
        ▼
multiPlatformScheduler.scheduleVideoAcrossPlatforms()
        │  per platform with a configured GHL account ID:
        ▼
ghlClient.createPost()  ──▶  HighLevel Social Planner (Social Media Posting API)
        │
        ▼
state/store.ts (data/state.json)
        - processedDriveFileIds  (never repost the same file)
        - scheduledPosts         (audit log)
        - nextSlotCursor         (keeps the posting queue moving forward)
```

```
Content framework Google Doc
        ▼
googleDocs.fetchDocAsPlainText()
        ▼
contentIdeaService.generateDailyIdeas()  ──▶  Claude, given the framework + already-used titles
        ▼
output/content-ideas-<date>.md  +  (optional) a Drive file in GOOGLE_DRIVE_OUTPUT_FOLDER_ID
        ▼
state.ideaHistory (dedupe memory)
```

```
Fathom (all recent recorded meetings)
        ▼
lib/fathom.ts: listMeetingsSince(lastSync)
        │  exclude meetings where every attendee is on a configured internal
        │  email domain (stand-in for Fathom-side team/tag separation, which
        │  doesn't exist yet in this workspace)
        ▼
callInsightService.syncCallInsights()
        │  Claude, instructed to strip names/company/identifying specifics
        │  from summaries + action items, extract recurring questions/
        │  objections/use-cases as anonymized themes
        ▼
output/call-themes-<date>.md  +  (optional) Drive file   [a readable "what clients are asking" report]
        ▼
state.callInsightHistory  +  state.fathomLastSyncedAt / processedFathomMeetingIds (dedupe + sync cursor)
        ▼
contentIdeaService.generateDailyIdeas()
        │  prompt now includes: framework doc + recent call themes + already-used titles
        ▼
daily content ideas (same output as before — a human still has to film based
on the idea, so nothing derived from a client call reaches a public post
without a person reading it and choosing to act on it first)
```

```
YouTube Data API search (per niche keyword, ranked by views/day)
        ▼
competitorResearchService.runCompetitorResearch()
        │  for each new top video: Claude infers why it works from
        │  title+description+stats, and writes an original script in your
        │  brand voice (NOT the competitor's actual words — this pipeline
        │  never has transcript access)
        ▼
output/competitor-research-<date>.md  +  (optional) Drive file
        │
        + a Claude-written manual-research checklist for Instagram/Facebook
          (no public API exists for pulling competitor metrics there)
        ▼
state.competitorVideoIdsUsed / competitorScriptHistory (dedupe memory)
```

## Why state lives in a committed JSON file

There's no database in this design on purpose — run volume is low (a few
jobs a day, a few dozen videos a week at most), and GitHub Actions runners
are ephemeral, so *something* has to persist between runs. Committing
`data/state.json` back to the repo after each workflow run is the simplest
thing that works without standing up infrastructure. If volume grows a lot
(many videos/day, many collaborators triggering runs concurrently), swap
`src/state/store.ts` for a real datastore (Postgres, a Google Sheet, etc.) —
every service takes `state` as a plain argument, so the storage layer is the
only thing that would need to change.

## Deliberate scope boundaries

- **Video transcripts aren't pulled for competitor YouTube videos.** Getting
  captions programmatically needs either YouTube OAuth (the video owner's
  permission) or third-party scraping of a moving, ToS-sensitive target.
  Scripts are instead built from title, description, channel, and
  performance signal — which is enough to identify *why* a video's hook/
  structure worked without ever reproducing its actual wording.
- **Instagram/Facebook competitor metrics are manual.** Neither platform
  exposes competitor post performance through any public API — only to the
  account owner, or through paid third-party scraping/social-listening
  tools. The system won't fabricate numbers for what it can't see; it
  generates a manual-research checklist instead. See `docs/SETUP.md` §6 for
  the paid-service path if you want that automated later.
- **`GHL createPost()` needs a live verification pass.** See the comment at
  the top of `src/lib/ghlClient.ts` and `docs/SETUP.md` §1 — this
  environment couldn't reach HighLevel's docs site to confirm the exact
  field names, so `DRY_RUN=true` is the default until someone runs one real
  test post and checks it against the Social Planner UI.
- **Call data is anonymized/thematic only, never verbatim.** Client call
  summaries and action items are sent to Claude as input signal, but the
  system prompt in `callInsightService.ts` forbids echoing any name, company,
  or identifying detail in the output — only the generalized pattern comes
  out. That output only ever lands in an internal idea doc a human reads
  before filming; it's never auto-published. The internal/external meeting
  filter is a best-effort email-domain heuristic (see `docs/SETUP.md` §5)
  since this Fathom workspace doesn't separate coaching calls from internal
  meetings by team/tag yet. `src/lib/fathom.ts`'s endpoint/field names need
  the same live-verification pass as the GHL client before trusting output
  at scale — see the comment at the top of that file.

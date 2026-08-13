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
  generates a manual-research checklist instead. See `docs/SETUP.md` §5 for
  the paid-service path if you want that automated later.
- **`GHL createPost()` needs a live verification pass.** See the comment at
  the top of `src/lib/ghlClient.ts` and `docs/SETUP.md` §1 — this
  environment couldn't reach HighLevel's docs site to confirm the exact
  field names, so `DRY_RUN=true` is the default until someone runs one real
  test post and checks it against the Social Planner UI.

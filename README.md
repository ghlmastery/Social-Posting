# Social Posting Engine

Automates three things for a GoHighLevel / business-consulting / coaching content
operation:

1. **Drive-to-multi-platform posting** — drop a finished video into a Google Drive
   folder, and it gets scheduled to Facebook, Instagram, and YouTube through your
   HighLevel Social Planner (Social Media Posting API), with AI-generated
   per-platform captions/titles.
2. **Daily content ideas** — generated from your own
   [content framework doc](https://docs.google.com/document/d/1asmHwaH9GraMqpYWlR5BdNngAty13OU5koiZktMj8kM/edit),
   deduped against everything generated before.
3. **Competitor research** — finds top-performing recent YouTube videos in the
   GoHighLevel / SaaS-agency / consulting / coaching niche, and writes a unique,
   brand-voiced script inspired by each one (never a copy).

**Start here:** [`docs/SETUP.md`](docs/SETUP.md) walks through every credential you
need (HighLevel, Google, YouTube, Anthropic) and both ways to run this
(GitHub Actions — no server needed — or an always-on VPS process).

## Quickstart

```bash
npm install
cp .env.example .env   # fill in your keys — see docs/SETUP.md
npm run verify:connections   # read-only smoke test of every integration
npm run job:ideas            # generate today's content ideas
npm run job:research         # run competitor research
npm run job:ingest           # scan the Drive inbox and schedule any new videos
```

`DRY_RUN=true` by default (see `.env.example`) — the ingest job will log what it
*would* schedule without calling the GHL API. Flip it to `false` only after
`verify:connections` succeeds and you've read the note at the top of
[`src/lib/ghlClient.ts`](src/lib/ghlClient.ts) about confirming the live API shape.

## Project layout

```
src/
  config.ts            all environment/config in one place
  types.ts              shared types
  lib/                   thin clients: Google Drive/Docs, YouTube Data API,
                          GHL Social Planner, Anthropic
  services/              the actual logic (ingest pipeline, caption writer,
                          scheduler, content ideas, competitor research)
  jobs/                   CLI entrypoints, one per scheduled task
  scheduler/              always-on cron runner (VPS alternative to Actions)
  state/                  JSON state persistence (data/state.json)
.github/workflows/       scheduled GitHub Actions (no hosting required)
docs/                     setup + architecture docs
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how the pieces fit together
and what's fully automated vs. what stays manual (Instagram/Facebook competitor
data has no public API — see that doc for why).

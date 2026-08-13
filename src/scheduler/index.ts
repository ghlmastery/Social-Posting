import cron from "node-cron";
import { config } from "../config.js";
import { ingestNewVideos } from "../services/driveVideoIngest.js";
import { generateDailyIdeas } from "../services/contentIdeaService.js";
import { runCompetitorResearch } from "../services/competitorResearchService.js";
import { withState } from "../state/store.js";

/**
 * Always-on alternative to the GitHub Actions workflows in .github/workflows/
 * (see docs/SETUP.md for which to use). Run with `npm run scheduler` under
 * a process manager (pm2, systemd, Docker) on a VPS.
 */

async function safeRun(label: string, fn: () => Promise<unknown>) {
  console.log(`[${new Date().toISOString()}] Starting: ${label}`);
  try {
    await fn();
    console.log(`[${new Date().toISOString()}] Finished: ${label}`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] FAILED: ${label}`, err);
  }
}

// Every 20 minutes: check the Drive inbox for new videos to schedule.
cron.schedule(
  "*/20 * * * *",
  () => safeRun("drive ingest", () => withState((state) => ingestNewVideos(state))),
  { timezone: config.posting.timezone }
);

// Daily at 07:00: generate content ideas from the framework doc.
cron.schedule(
  "0 7 * * *",
  () => safeRun("daily content ideas", () => withState((state) => generateDailyIdeas(state))),
  { timezone: config.posting.timezone }
);

// Weekly, Monday 06:00: competitor research + unique script generation.
cron.schedule(
  "0 6 * * 1",
  () => safeRun("competitor research", () => withState((state) => runCompetitorResearch(state))),
  { timezone: config.posting.timezone }
);

console.log(`Scheduler running (timezone: ${config.posting.timezone}). DRY_RUN=${config.dryRun}.`);
console.log("Jobs: drive ingest every 20min, daily ideas at 07:00, competitor research Mondays 06:00.");

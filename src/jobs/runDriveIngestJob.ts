import { config } from "../config.js";
import { ingestNewVideos } from "../services/driveVideoIngest.js";
import { withState } from "../state/store.js";

async function main() {
  console.log(`Running Drive ingest job (DRY_RUN=${config.dryRun})...`);
  const summary = await withState((state) => ingestNewVideos(state));

  console.log(`Scanned ${summary.scanned} video(s) in inbox folder.`);
  console.log(`Scheduled ${summary.newlyScheduled} new video(s) across platforms.`);
  for (const record of summary.records) {
    console.log(
      `  - ${record.driveFileName} -> ${record.platform} at ${record.scheduledFor}${record.dryRun ? " [DRY RUN]" : ""}`
    );
  }
  if (summary.errors.length) {
    console.error(`${summary.errors.length} error(s):`);
    for (const e of summary.errors) console.error(`  - ${e.fileName}: ${e.error}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Drive ingest job failed:", err);
  process.exitCode = 1;
});

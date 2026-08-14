import { syncCallInsights } from "../services/callInsightService.js";
import { withState } from "../state/store.js";

async function main() {
  console.log("Syncing Fathom call insights...");
  const result = await withState((state) => syncCallInsights(state));

  console.log(
    `Checked ${result.meetingsConsidered} new meeting(s), excluded ${result.meetingsSkippedInternal} as internal-only.`
  );
  console.log(`Extracted ${result.insights.length} theme(s).`);
  console.log(result.markdown);
  if (result.driveFileId) {
    console.log(`Saved to Drive file: ${result.driveFileId}`);
  } else {
    console.log("GOOGLE_DRIVE_OUTPUT_FOLDER_ID not set — saved locally under output/ only.");
  }
}

main().catch((err) => {
  console.error("Call insights job failed:", err);
  process.exitCode = 1;
});

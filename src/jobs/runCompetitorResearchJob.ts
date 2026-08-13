import { runCompetitorResearch } from "../services/competitorResearchService.js";
import { withState } from "../state/store.js";

async function main() {
  console.log("Running competitor research...");
  const result = await withState((state) => runCompetitorResearch(state));

  console.log(`Found ${result.topVideos.length} new top-performing YouTube video(s).`);
  console.log(result.markdown);
  if (result.driveFileId) {
    console.log(`Saved to Drive file: ${result.driveFileId}`);
  } else {
    console.log("GOOGLE_DRIVE_OUTPUT_FOLDER_ID not set — saved locally under output/ only.");
  }
}

main().catch((err) => {
  console.error("Competitor research job failed:", err);
  process.exitCode = 1;
});

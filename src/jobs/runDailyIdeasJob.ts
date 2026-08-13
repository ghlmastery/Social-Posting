import { generateDailyIdeas } from "../services/contentIdeaService.js";
import { withState } from "../state/store.js";

async function main() {
  console.log("Generating daily content ideas from framework doc...");
  const result = await withState((state) => generateDailyIdeas(state));

  console.log(`Generated ${result.ideas.length} idea(s).`);
  console.log(result.markdown);
  if (result.driveFileId) {
    console.log(`Saved to Drive file: ${result.driveFileId}`);
  } else {
    console.log("GOOGLE_DRIVE_OUTPUT_FOLDER_ID not set — saved locally under output/ only.");
  }
}

main().catch((err) => {
  console.error("Daily ideas job failed:", err);
  process.exitCode = 1;
});

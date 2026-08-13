import { config } from "../config.js";
import { assertGoogleConfigured } from "../lib/googleAuth.js";
import { fetchDocAsPlainText } from "../lib/googleDocs.js";
import { listVideosInFolder } from "../lib/googleDrive.js";
import { listAccounts } from "../lib/ghlClient.js";
import { required } from "../config.js";

/** Read-only smoke test for every external integration. Safe to run anytime. */
async function main() {
  let ok = true;

  console.log("== GoHighLevel Social Planner ==");
  try {
    required("GHL_API_TOKEN");
    required("GHL_LOCATION_ID");
    const accounts = await listAccounts();
    console.log(`Connected. ${accounts.length} social account(s) found:`);
    for (const a of accounts) console.log(`  - [${a.platform}] ${a.name} (id: ${a.id})`);
    console.log(
      "Match these IDs into GHL_FACEBOOK_ACCOUNT_ID / GHL_INSTAGRAM_ACCOUNT_ID / GHL_YOUTUBE_ACCOUNT_ID in your .env."
    );
  } catch (err) {
    ok = false;
    console.error("FAILED:", (err as Error).message);
  }

  console.log("\n== Google Drive (inbox folder) ==");
  try {
    assertGoogleConfigured();
    const folderId = required("GOOGLE_DRIVE_INBOX_FOLDER_ID");
    const videos = await listVideosInFolder(folderId);
    console.log(`Connected. ${videos.length} video(s) currently in inbox folder.`);
  } catch (err) {
    ok = false;
    console.error("FAILED:", (err as Error).message);
  }

  console.log("\n== Google Docs (content framework doc) ==");
  try {
    assertGoogleConfigured();
    const text = await fetchDocAsPlainText(config.google.frameworkDocId);
    console.log(`Connected. Framework doc has ${text.length} characters.`);
  } catch (err) {
    ok = false;
    console.error("FAILED:", (err as Error).message);
  }

  console.log("\n== YouTube Data API ==");
  try {
    required("YOUTUBE_API_KEY");
    console.log("YOUTUBE_API_KEY is set (run `npm run job:research` to exercise it live).");
  } catch (err) {
    ok = false;
    console.error("FAILED:", (err as Error).message);
  }

  console.log("\n== Anthropic ==");
  try {
    required("ANTHROPIC_API_KEY");
    console.log(`ANTHROPIC_API_KEY is set (model: ${config.anthropic.model}).`);
  } catch (err) {
    ok = false;
    console.error("FAILED:", (err as Error).message);
  }

  console.log(`\nDRY_RUN is currently ${config.dryRun ? "ON (safe)" : "OFF (will publish live posts)"}.`);
  process.exitCode = ok ? 0 : 1;
}

main();

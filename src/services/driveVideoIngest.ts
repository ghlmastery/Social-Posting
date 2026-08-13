import { config, required } from "../config.js";
import { driveDirectDownloadUrl, ensurePubliclyReadable, listVideosInFolder, moveToFolder } from "../lib/googleDrive.js";
import { nextSlotDateTime, scheduleVideoAcrossPlatforms } from "./multiPlatformScheduler.js";
import type { EngineState, ScheduledPostRecord } from "../types.js";

export interface IngestSummary {
  scanned: number;
  newlyScheduled: number;
  records: ScheduledPostRecord[];
  errors: { fileName: string; error: string }[];
}

/**
 * Scans the inbox Drive folder for videos not yet processed, and for each
 * one: makes it link-accessible, schedules a post per platform via GHL, then
 * (if configured) moves it into the archive folder so it isn't reprocessed.
 */
export async function ingestNewVideos(state: EngineState): Promise<IngestSummary> {
  const folderId = required("GOOGLE_DRIVE_INBOX_FOLDER_ID");
  const videos = await listVideosInFolder(folderId);
  const processed = new Set(state.processedDriveFileIds);

  const summary: IngestSummary = { scanned: videos.length, newlyScheduled: 0, records: [], errors: [] };

  for (const video of videos) {
    if (processed.has(video.id)) continue;

    try {
      await ensurePubliclyReadable(video.id);
      const videoUrl = driveDirectDownloadUrl(video.id);

      const { iso, nextCursor } = nextSlotDateTime(state.nextSlotCursor);
      const records = await scheduleVideoAcrossPlatforms(video, videoUrl, iso);

      state.nextSlotCursor = nextCursor;
      state.scheduledPosts.push(...records);
      state.processedDriveFileIds.push(video.id);
      summary.records.push(...records);
      summary.newlyScheduled += 1;

      if (config.google.archiveFolderId) {
        await moveToFolder(video.id, config.google.archiveFolderId, folderId);
      }
    } catch (err) {
      summary.errors.push({ fileName: video.name, error: (err as Error).message });
    }
  }

  return summary;
}

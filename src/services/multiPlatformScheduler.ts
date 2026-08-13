import { config } from "../config.js";
import { createPost } from "../lib/ghlClient.js";
import { generateCaptions, renderCaptionText } from "./captionGenerator.js";
import type { DriveVideoFile, Platform, ScheduledPostRecord } from "../types.js";

const PLATFORM_ACCOUNT_IDS: Record<Platform, string> = {
  facebook: config.ghl.accounts.facebook,
  instagram: config.ghl.accounts.instagram,
  youtube: config.ghl.accounts.youtube,
};

/**
 * Round-robins through POSTING_SLOT_TIMES, advancing to the next day once
 * all slots for "today" are used. `cursor` is persisted in state so runs
 * keep filling the queue forward instead of overlapping.
 */
export function nextSlotDateTime(cursor: number): { iso: string; nextCursor: number } {
  const slots = config.posting.slotTimes;
  const dayOffset = Math.floor(cursor / slots.length);
  const slotIndex = cursor % slots.length;
  const [hh, mm] = slots[slotIndex]!.split(":").map(Number);

  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hh!, mm!, 0, 0);

  // A slot in the past (e.g. cursor=0 but 09:00 already happened today) just
  // rolls forward one day rather than double-booking today's remaining slots.
  if (date.getTime() <= Date.now()) {
    date.setDate(date.getDate() + 1);
  }

  return { iso: date.toISOString(), nextCursor: cursor + 1 };
}

/**
 * Schedules one Drive video across every platform that has a configured GHL
 * account ID. Missing account IDs are skipped with a warning rather than
 * failing the whole run.
 */
export async function scheduleVideoAcrossPlatforms(
  video: DriveVideoFile,
  videoUrl: string,
  scheduleIso: string
): Promise<ScheduledPostRecord[]> {
  const captions = await generateCaptions(video.name);
  const records: ScheduledPostRecord[] = [];

  for (const caption of captions) {
    const accountId = PLATFORM_ACCOUNT_IDS[caption.platform];
    if (!accountId) {
      console.warn(`Skipping ${caption.platform}: no GHL account ID configured.`);
      continue;
    }

    const result = await createPost({
      accountId,
      platform: caption.platform,
      summary: renderCaptionText(caption),
      title: caption.title,
      videoUrl,
      scheduleDateIso: scheduleIso,
    });

    records.push({
      driveFileId: video.id,
      driveFileName: video.name,
      platform: caption.platform,
      ghlPostId: result.id,
      scheduledFor: scheduleIso,
      createdAt: new Date().toISOString(),
      dryRun: config.dryRun,
    });
  }

  return records;
}

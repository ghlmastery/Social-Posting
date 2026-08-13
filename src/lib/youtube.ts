import { google } from "googleapis";
import { config, required } from "../config.js";
import type { CompetitorVideo } from "../types.js";

function client() {
  return google.youtube({ version: "v3", auth: required("YOUTUBE_API_KEY") });
}

/**
 * Searches public YouTube for a keyword, published within the last N days,
 * then pulls stats for each result. This only needs an API key (no OAuth) —
 * it reads public data, same as any visitor could see.
 */
export async function searchRecentVideos(
  keyword: string,
  publishedAfterDays = 30,
  maxResults = 15
): Promise<CompetitorVideo[]> {
  const youtube = client();
  const publishedAfter = new Date(
    Date.now() - publishedAfterDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const searchRes = await youtube.search.list({
    part: ["id"],
    q: keyword,
    type: ["video"],
    order: "viewCount",
    publishedAfter,
    maxResults,
  });

  const videoIds = (searchRes.data.items ?? [])
    .map((item) => item.id?.videoId)
    .filter((id): id is string => Boolean(id));

  if (videoIds.length === 0) return [];

  const videosRes = await youtube.videos.list({
    part: ["snippet", "statistics"],
    id: videoIds,
  });

  const now = Date.now();
  return (videosRes.data.items ?? []).map((v) => {
    const publishedAt = v.snippet?.publishedAt ?? new Date().toISOString();
    const ageDays = Math.max(1, (now - new Date(publishedAt).getTime()) / 86_400_000);
    const viewCount = Number(v.statistics?.viewCount ?? 0);
    return {
      videoId: v.id ?? "",
      channelTitle: v.snippet?.channelTitle ?? "Unknown",
      title: v.snippet?.title ?? "",
      url: `https://www.youtube.com/watch?v=${v.id}`,
      publishedAt,
      viewCount,
      likeCount: Number(v.statistics?.likeCount ?? 0),
      viewsPerDay: Math.round(viewCount / ageDays),
      description: v.snippet?.description ?? "",
    } satisfies CompetitorVideo;
  });
}

/** Convenience: search every configured niche keyword and merge results. */
export async function searchAllNicheKeywords(): Promise<CompetitorVideo[]> {
  const results: CompetitorVideo[] = [];
  for (const keyword of config.youtube.nicheKeywords) {
    const found = await searchRecentVideos(keyword);
    results.push(...found);
  }
  // De-dupe by videoId, keep highest views/day.
  const byId = new Map<string, CompetitorVideo>();
  for (const v of results) {
    const existing = byId.get(v.videoId);
    if (!existing || v.viewsPerDay > existing.viewsPerDay) byId.set(v.videoId, v);
  }
  return [...byId.values()].sort((a, b) => b.viewsPerDay - a.viewsPerDay);
}

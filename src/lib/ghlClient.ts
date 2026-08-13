import { config, required } from "../config.js";
import type { Platform } from "../types.js";

/**
 * Client for HighLevel's Social Planner ("Social Media Posting API").
 *
 * IMPORTANT — verify before first real (non-dry-run) use: this session could
 * not reach marketplace.gohighlevel.com (network egress to that domain is
 * blocked in this environment) to confirm the exact live request/response
 * shapes, so the endpoint paths and JSON fields below are built from
 * HighLevel's documented v2 API conventions (Bearer auth, `Version` header,
 * `/social-media-posting/{locationId}/...` routes) rather than a fetched
 * schema. Run `npm run verify:connections` first (read-only — lists your
 * connected accounts) to confirm auth + base URL. Before running the ingest
 * job with DRY_RUN=false, do one manual test post via createPost and check
 * it actually appears (as scheduled/draft) in the Social Planner UI, then
 * diff the fields here against https://marketplace.gohighlevel.com/docs/ghl/social-planner/
 * if anything doesn't match.
 */

export interface GhlSocialAccount {
  id: string;
  platform: string;
  name: string;
}

export interface CreatePostInput {
  accountId: string;
  platform: Platform;
  summary: string;
  title?: string; // used for YouTube
  videoUrl: string;
  scheduleDateIso: string;
}

export interface CreatePostResult {
  id: string;
  raw: unknown;
}

function headers() {
  return {
    Authorization: `Bearer ${required("GHL_API_TOKEN")}`,
    Version: config.ghl.apiVersion,
    "Content-Type": "application/json",
  };
}

function baseUrl() {
  return config.ghl.baseUrl.replace(/\/$/, "");
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, { ...init, headers: headers() });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    // leave as raw text
  }
  if (!res.ok) {
    throw new Error(
      `GHL API error ${res.status} ${res.statusText} on ${path}: ${JSON.stringify(body).slice(0, 500)}`
    );
  }
  return body as T;
}

export async function listAccounts(): Promise<GhlSocialAccount[]> {
  const locationId = required("GHL_LOCATION_ID");
  const data = await request<{ accounts?: GhlSocialAccount[] } | GhlSocialAccount[]>(
    `/social-media-posting/${locationId}/accounts`,
    { method: "GET" }
  );
  return Array.isArray(data) ? data : (data.accounts ?? []);
}

export async function createPost(input: CreatePostInput): Promise<CreatePostResult> {
  const locationId = required("GHL_LOCATION_ID");

  if (config.dryRun) {
    console.log(
      `[DRY RUN] Would create ${input.platform} post via account ${input.accountId} for "${input.videoUrl}" scheduled ${input.scheduleDateIso}`
    );
    return { id: `dry-run-${Date.now()}`, raw: { dryRun: true, input } };
  }

  const body = {
    accountIds: [input.accountId],
    summary: input.summary,
    title: input.title,
    media: [{ url: input.videoUrl, type: "video" }],
    status: "scheduled",
    scheduleDate: input.scheduleDateIso,
  };

  const data = await request<{ id?: string; postId?: string }>(
    `/social-media-posting/${locationId}/posts`,
    { method: "POST", body: JSON.stringify(body) }
  );

  const id = data.id ?? data.postId;
  if (!id) throw new Error(`GHL createPost did not return an id: ${JSON.stringify(data)}`);
  return { id, raw: data };
}

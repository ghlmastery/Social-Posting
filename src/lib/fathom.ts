import { config, required } from "../config.js";
import type { FathomMeeting } from "../types.js";

/**
 * Client for Fathom's call-recording API (fathom.video).
 *
 * IMPORTANT — verify before trusting output at scale: this session could not
 * reach developers.fathom.ai, docs.fathom.ai, or help.fathom.video (network
 * egress to those domains is blocked in this environment) to confirm the
 * exact live request/response shapes, so the endpoint path, query params,
 * and field names below are built from search-engine snippets and
 * third-party integration references, not a fetched schema. Confirmed with
 * reasonable confidence: base URL `https://api.fathom.ai/external/v1`, an
 * `X-Api-Key` auth header, and a `GET /meetings` endpoint supporting
 * `created_after`/`include_summary`/`include_action_items`/`include_transcript`
 * filters. Run `npm run verify:connections` first (read-only), then check
 * one real `npm run job:call-insights` run's console output against
 * https://developers.fathom.ai/api-reference/ if anything looks off — same
 * "verify then adjust one file" pattern used for `src/lib/ghlClient.ts`.
 */

function headers() {
  return {
    "X-Api-Key": required("FATHOM_API_KEY"),
    "Content-Type": "application/json",
  };
}

function baseUrl() {
  return config.fathom.baseUrl.replace(/\/$/, "");
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
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
      `Fathom API error ${res.status} ${res.statusText} on ${path}: ${JSON.stringify(body).slice(0, 500)}`
    );
  }
  return body as T;
}

type RawMeetingsResponse =
  | unknown[]
  | { items?: unknown[]; meetings?: unknown[]; next_cursor?: string | null; nextCursor?: string | null };

async function fetchMeetingsPage(
  sinceIso: string,
  cursor?: string
): Promise<{ rows: unknown[]; nextCursor?: string }> {
  const params = new URLSearchParams({
    created_after: sinceIso,
    include_summary: "true",
    include_action_items: "true",
    include_transcript: String(config.fathom.includeTranscript),
  });
  if (cursor) params.set("cursor", cursor);

  const data = await request<RawMeetingsResponse>(`/meetings?${params.toString()}`, { method: "GET" });
  if (Array.isArray(data)) return { rows: data };
  return { rows: data.items ?? data.meetings ?? [], nextCursor: data.next_cursor ?? data.nextCursor ?? undefined };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function extractAttendeeEmails(raw: Record<string, unknown>): string[] {
  const invitees = raw.calendar_invitees ?? raw.invitees ?? raw.participants ?? [];
  if (!Array.isArray(invitees)) return [];
  return invitees
    .map((inv) => (typeof inv === "string" ? inv : asRecord(inv).email))
    .filter((email): email is string => typeof email === "string" && email.length > 0);
}

function extractSummaryText(summary: unknown): string | undefined {
  if (typeof summary === "string") return summary || undefined;
  const rec = asRecord(summary);
  const text = rec.markdown_formatted ?? rec.text ?? rec.content;
  return typeof text === "string" && text.length > 0 ? text : undefined;
}

function extractActionItems(items: unknown): string[] | undefined {
  if (!Array.isArray(items) || items.length === 0) return undefined;
  const mapped = items
    .map((it) => {
      if (typeof it === "string") return it;
      const rec = asRecord(it);
      const text = rec.description ?? rec.text ?? rec.title;
      return typeof text === "string" ? text : undefined;
    })
    .filter((text): text is string => Boolean(text));
  return mapped.length > 0 ? mapped : undefined;
}

function mapMeeting(raw: Record<string, unknown>): FathomMeeting | null {
  const id = raw.id ?? raw.recording_id;
  const createdAt = raw.created_at ?? raw.createdAt ?? raw.scheduled_start_time;
  if (typeof id !== "string" && typeof id !== "number") return null;
  if (typeof createdAt !== "string") return null;

  const title = raw.title ?? raw.meeting_title;
  const url = raw.url ?? raw.meeting_url ?? raw.recording_url;

  return {
    id: String(id),
    title: typeof title === "string" && title ? title : "(untitled meeting)",
    url: typeof url === "string" ? url : "",
    createdAt,
    attendeeEmails: extractAttendeeEmails(raw),
    summary: extractSummaryText(raw.summary),
    actionItems: extractActionItems(raw.action_items ?? raw.actionItems),
  };
}

/** Lists meetings created since `sinceIso`, following pagination to completion. */
export async function listMeetingsSince(sinceIso: string): Promise<FathomMeeting[]> {
  const results: FathomMeeting[] = [];
  let cursor: string | undefined;

  do {
    const { rows, nextCursor } = await fetchMeetingsPage(sinceIso, cursor);
    for (const raw of rows) {
      const meeting = mapMeeting(asRecord(raw));
      if (meeting) results.push(meeting);
    }
    cursor = nextCursor;
  } while (cursor);

  return results;
}

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { config } from "../config.js";
import { generateStructured } from "../lib/anthropic.js";
import { listMeetingsSince } from "../lib/fathom.js";
import { createTextFileInFolder } from "../lib/googleDrive.js";
import type { CallInsight, EngineState, FathomMeeting } from "../types.js";

const SYSTEM_PROMPT = `You extract anonymized, aggregate content themes from internal
call notes (coaching and sales calls for a GoHighLevel-focused business serving
agencies, consultants, and coaches). These notes may contain client names, company
names, emails, phone numbers, or other identifying details. You NEVER include any of
that in your output, even if it is present in the source material — you describe only
the recurring question, objection, confusion point, or use-case pattern, the way you'd
describe something seen across many conversations, not one person's specific
situation. If a source note clearly reads as an internal team meeting rather than a
client conversation, ignore it entirely rather than turning it into a "theme."`;

interface CallThemeResponse {
  themes: { theme: string; description: string; contentAngle: string; mentionCount: number }[];
}

const CALL_THEME_SCHEMA = {
  type: "object" as const,
  properties: {
    themes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          theme: { type: "string" },
          description: { type: "string" },
          contentAngle: { type: "string" },
          mentionCount: { type: "number" },
        },
        required: ["theme", "description", "contentAngle", "mentionCount"],
      },
    },
  },
  required: ["themes"],
};

export interface CallInsightsResult {
  insights: CallInsight[];
  markdown: string;
  driveFileId?: string;
  meetingsConsidered: number;
  meetingsSkippedInternal: number;
}

function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).toLowerCase();
}

function isInternalDomain(domain: string, internalDomains: string[]): boolean {
  return internalDomains.some((d) => domain === d.toLowerCase() || domain.endsWith(`.${d.toLowerCase()}`));
}

/**
 * Fathom doesn't (yet) separate coaching/client calls from internal meetings
 * by team/tag here, so this is a best-effort stand-in: a meeting is treated
 * as internal-only if every attendee is on a configured company domain, or
 * if there's no attendee data at all to check (erring toward excluding when
 * we can't confirm a call had an external client on it).
 */
function isInternalOnlyMeeting(meeting: FathomMeeting): boolean {
  const domains = config.fathom.internalEmailDomains;
  if (domains.length === 0) return false;
  if (meeting.attendeeEmails.length === 0) return true;
  return meeting.attendeeEmails.every((email) => isInternalDomain(emailDomain(email), domains));
}

export async function syncCallInsights(state: EngineState): Promise<CallInsightsResult> {
  const sinceIso =
    state.fathomLastSyncedAt ??
    new Date(Date.now() - config.fathom.lookbackDays * 86_400_000).toISOString();

  const fetchedMeetings = await listMeetingsSince(sinceIso);
  const alreadyProcessed = new Set(state.processedFathomMeetingIds);
  const newMeetings = fetchedMeetings.filter((m) => !alreadyProcessed.has(m.id));
  const externalMeetings = newMeetings.filter((m) => !isInternalOnlyMeeting(m));
  const meetingsSkippedInternal = newMeetings.length - externalMeetings.length;

  state.fathomLastSyncedAt = new Date().toISOString();
  for (const m of newMeetings) state.processedFathomMeetingIds.push(m.id);

  if (externalMeetings.length === 0) {
    const markdown = renderMarkdown([], newMeetings.length, meetingsSkippedInternal);
    await writeOutput(markdown);
    return {
      insights: [],
      markdown,
      meetingsConsidered: newMeetings.length,
      meetingsSkippedInternal,
    };
  }

  const recentThemes = state.callInsightHistory.slice(-30).map((t) => t.theme);
  const prompt = buildPrompt(externalMeetings, recentThemes);
  const response = await generateStructured<CallThemeResponse>(
    SYSTEM_PROMPT,
    prompt,
    CALL_THEME_SCHEMA,
    3000
  );

  const insights: CallInsight[] = response.themes.map((t) => ({
    id: randomUUID(),
    theme: t.theme,
    description: t.description,
    contentAngle: t.contentAngle,
    mentionCount: t.mentionCount,
    createdAt: new Date().toISOString(),
  }));

  state.callInsightHistory.push(...insights);

  const markdown = renderMarkdown(insights, newMeetings.length, meetingsSkippedInternal);
  const driveFileId = await writeOutput(markdown);

  return {
    insights,
    markdown,
    driveFileId,
    meetingsConsidered: newMeetings.length,
    meetingsSkippedInternal,
  };
}

function buildPrompt(meetings: FathomMeeting[], recentThemes: string[]): string {
  const meetingBlock = meetings
    .map((m, i) => {
      const date = m.createdAt.slice(0, 10);
      const actionItems = m.actionItems?.length ? m.actionItems.join("; ") : "(none)";
      return `Call ${i + 1} (${date}): "${m.title}"\nSummary: ${m.summary ?? "(no summary available)"}\nAction items: ${actionItems}`;
    })
    .join("\n\n");

  return `Here are notes from ${meetings.length} recent client coaching/sales calls:
"""
${meetingBlock}
"""

Already-identified themes (do NOT repeat these — look for new or different patterns):
${recentThemes.length ? recentThemes.map((t) => `- ${t}`).join("\n") : "(none yet)"}

Extract up to 6 recurring content-worthy themes across these calls: questions clients
keep asking, objections, points of confusion, or things clients are actively asking
about or building with GoHighLevel. For each theme return:
- theme: a short label (5-8 words)
- description: 1-2 sentences on the pattern, written generically (no names, no company specifics)
- contentAngle: a one-sentence suggestion for a video/content angle this theme could become
- mentionCount: your best estimate of how many of the calls above touched on this theme`;
}

async function writeOutput(markdown: string): Promise<string | undefined> {
  const today = new Date().toISOString().slice(0, 10);
  await mkdir("output", { recursive: true });
  await writeFile(`output/call-themes-${today}.md`, markdown, "utf-8");

  if (!config.google.outputFolderId) return undefined;
  return createTextFileInFolder(`Call Themes - ${today}.md`, markdown, config.google.outputFolderId);
}

function renderMarkdown(insights: CallInsight[], consideredCount: number, skippedInternal: number): string {
  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    `# Client Call Themes — ${date}`,
    "",
    `_Synced ${consideredCount} new meeting(s); ${skippedInternal} excluded as internal-only._`,
    "",
  ];

  if (insights.length === 0) {
    lines.push("No new external client-call themes this run.");
    return lines.join("\n");
  }

  insights.forEach((insight, i) => {
    lines.push(
      `## ${i + 1}. ${insight.theme}`,
      `- **Seen in ~${insight.mentionCount} call(s)**`,
      `- **Pattern:** ${insight.description}`,
      `- **Content angle:** ${insight.contentAngle}`,
      ""
    );
  });
  return lines.join("\n");
}

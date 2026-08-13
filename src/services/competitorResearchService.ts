import { mkdir, writeFile } from "node:fs/promises";
import { config } from "../config.js";
import { generateJson, generateText } from "../lib/anthropic.js";
import { createTextFileInFolder } from "../lib/googleDrive.js";
import { searchAllNicheKeywords } from "../lib/youtube.js";
import type { CompetitorScriptPackage, CompetitorVideo, EngineState } from "../types.js";

const SCRIPT_SYSTEM_PROMPT = `You are a scriptwriter for a GoHighLevel / SaaS-agency /
business-consulting / coaching brand. Given a competitor's high-performing video (title,
channel, description, and performance signal — NOT a full transcript, since YouTube
transcripts require separate OAuth access this pipeline doesn't have), you infer why it
likely performed well and write a genuinely original script inspired by the same
structural pattern, in this brand's own voice, with different examples/wording. You
never claim the rewritten script contains the competitor's actual words — you did not
receive them.`;

interface ScriptResponse {
  whyItWorks: string;
  uniqueScript: string;
  suggestedHook: string;
  suggestedCta: string;
}

export interface CompetitorResearchResult {
  topVideos: CompetitorVideo[];
  scriptPackages: CompetitorScriptPackage[];
  igFbResearchNotes: string;
  markdown: string;
  driveFileId?: string;
}

export async function runCompetitorResearch(
  state: EngineState,
  topN = 3
): Promise<CompetitorResearchResult> {
  const allVideos = await searchAllNicheKeywords();
  const used = new Set(state.competitorVideoIdsUsed);
  const candidates = allVideos.filter((v) => !used.has(v.videoId)).slice(0, topN);

  const scriptPackages: CompetitorScriptPackage[] = [];
  for (const video of candidates) {
    const prompt = `Competitor video:
- Title: "${video.title}"
- Channel: ${video.channelTitle}
- Published: ${video.publishedAt}
- Views: ${video.viewCount} (${video.viewsPerDay}/day)
- Description: "${video.description.slice(0, 800)}"

Return JSON exactly as:
{ "whyItWorks": string, "uniqueScript": string, "suggestedHook": string, "suggestedCta": string }

- whyItWorks: 2-4 sentences analyzing the likely hook/structure/promise pattern from the title+description.
- uniqueScript: a full ~45-90 second video script (hook, body, CTA) in OUR brand voice
  (direct, practical, agency-owner-to-agency-owner) inspired by that pattern but with
  original wording, examples, and no copied phrases.
- suggestedHook: the single opening line, isolated.
- suggestedCta: the closing call-to-action, isolated.`;

    const result = await generateJson<ScriptResponse>(SCRIPT_SYSTEM_PROMPT, prompt, 2500);

    scriptPackages.push({
      sourceVideo: video,
      whyItWorks: result.whyItWorks,
      uniqueScript: result.uniqueScript,
      suggestedHook: result.suggestedHook,
      suggestedCta: result.suggestedCta,
      createdAt: new Date().toISOString(),
    });

    state.competitorVideoIdsUsed.push(video.videoId);
  }

  state.competitorScriptHistory.push(...scriptPackages);

  const igFbResearchNotes = await generateIgFbResearchNotes();
  const today = new Date().toISOString().slice(0, 10);
  const markdown = renderMarkdown(today, scriptPackages, igFbResearchNotes);

  await mkdir("output", { recursive: true });
  const localPath = `output/competitor-research-${today}.md`;
  await writeFile(localPath, markdown, "utf-8");

  let driveFileId: string | undefined;
  if (config.google.outputFolderId) {
    driveFileId = await createTextFileInFolder(
      `Competitor Research - ${today}.md`,
      markdown,
      config.google.outputFolderId
    );
  }

  return { topVideos: candidates, scriptPackages, igFbResearchNotes, markdown, driveFileId };
}

/**
 * Instagram and Facebook expose no public API for a third party to pull
 * competitor view/like counts — that data is only visible to the account
 * owner (or via paid scraping services like Apify/Phyllo, not wired up
 * here). Rather than fabricate numbers, this generates a manual-research
 * checklist: where to look and what to search for on those platforms.
 */
async function generateIgFbResearchNotes(): Promise<string> {
  return generateText(
    `You give tactical, honest manual-research guidance. You never invent specific
account names, video titles, or performance numbers you weren't given — you only
describe a repeatable process a human can follow this week.`,
    `Write a short (under 250 words) weekly checklist for manually researching
top-performing Instagram Reels and Facebook video content in the niche of
GoHighLevel software, SaaS-for-agencies, business consulting, and coaching.
Cover: which in-app tools to use (Reels/Explore, Facebook Ad Library, saved
searches), what hashtags/search terms to try, and what signals indicate a
post is over-performing for its account size. End with a one-line reminder
that Instagram/Facebook don't expose this data via public API, so this step
stays manual unless a paid scraping/social-listening service is added.`,
    800
  );
}

function renderMarkdown(
  date: string,
  packages: CompetitorScriptPackage[],
  igFbNotes: string
): string {
  const lines = [`# Competitor Research & Scripts — ${date}`, "", "## YouTube (automated)", ""];
  packages.forEach((pkg, i) => {
    lines.push(
      `### ${i + 1}. Inspired by: "${pkg.sourceVideo.title}" — ${pkg.sourceVideo.channelTitle}`,
      `Source: ${pkg.sourceVideo.url} (${pkg.sourceVideo.viewsPerDay} views/day)`,
      "",
      `**Why it works:** ${pkg.whyItWorks}`,
      "",
      `**Your script:**`,
      "",
      pkg.uniqueScript,
      "",
      `**Hook:** ${pkg.suggestedHook}`,
      `**CTA:** ${pkg.suggestedCta}`,
      ""
    );
  });
  lines.push("## Instagram & Facebook (manual — see notes)", "", igFbNotes, "");
  return lines.join("\n");
}

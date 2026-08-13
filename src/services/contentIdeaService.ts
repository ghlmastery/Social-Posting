import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { config } from "../config.js";
import { generateJson } from "../lib/anthropic.js";
import { fetchDocAsPlainText } from "../lib/googleDocs.js";
import { createTextFileInFolder } from "../lib/googleDrive.js";
import type { ContentIdea, EngineState } from "../types.js";

const SYSTEM_PROMPT = `You are a content strategist for a business serving GoHighLevel
users, SaaS-enabled agencies, business consultants, and coaches. You generate daily
short-form video content ideas by strictly applying the user's own content framework
document (given verbatim below each time) — don't invent a different framework.`;

interface IdeaResponse {
  ideas: { title: string; hook: string; angle: string; format: string; frameworkPillar: string }[];
}

export interface DailyIdeasResult {
  ideas: ContentIdea[];
  markdown: string;
  driveFileId?: string;
}

export async function generateDailyIdeas(
  state: EngineState,
  count = 5
): Promise<DailyIdeasResult> {
  const framework = await fetchDocAsPlainText(config.google.frameworkDocId);
  const recentTitles = state.ideaHistory.slice(-60).map((i) => i.title);

  const prompt = `CONTENT FRAMEWORK DOCUMENT:
"""
${framework}
"""

Niche: GoHighLevel software / SaaS tooling for agencies, business consulting, coaching.

Already-used titles (do NOT repeat these or close variants):
${recentTitles.length ? recentTitles.map((t) => `- ${t}`).join("\n") : "(none yet)"}

Generate ${count} NEW daily content ideas by applying the framework above.
Return JSON exactly as:
{ "ideas": [ { "title": string, "hook": string, "angle": string, "format": string, "frameworkPillar": string } ] }

- title: the video's working title.
- hook: the exact first line/sentence to say on camera.
- angle: 1-2 sentences on the specific take/story/example.
- format: e.g. "talking head", "screen share demo", "before/after", "client story".
- frameworkPillar: which pillar/category from the framework doc this maps to.`;

  const response = await generateJson<IdeaResponse>(SYSTEM_PROMPT, prompt, 3000);

  const today = new Date().toISOString().slice(0, 10);
  const ideas: ContentIdea[] = response.ideas.map((i) => ({
    id: randomUUID(),
    title: i.title,
    hook: i.hook,
    angle: i.angle,
    format: i.format,
    frameworkPillar: i.frameworkPillar,
    createdAt: new Date().toISOString(),
  }));

  state.ideaHistory.push(...ideas);

  const markdown = renderIdeasMarkdown(today, ideas);

  await mkdir("output", { recursive: true });
  const localPath = `output/content-ideas-${today}.md`;
  await writeFile(localPath, markdown, "utf-8");

  let driveFileId: string | undefined;
  if (config.google.outputFolderId) {
    driveFileId = await createTextFileInFolder(
      `Content Ideas - ${today}.md`,
      markdown,
      config.google.outputFolderId
    );
  }

  return { ideas, markdown, driveFileId };
}

function renderIdeasMarkdown(date: string, ideas: ContentIdea[]): string {
  const lines = [`# Content Ideas — ${date}`, ""];
  ideas.forEach((idea, i) => {
    lines.push(
      `## ${i + 1}. ${idea.title}`,
      `- **Pillar:** ${idea.frameworkPillar}`,
      `- **Format:** ${idea.format}`,
      `- **Hook:** ${idea.hook}`,
      `- **Angle:** ${idea.angle}`,
      ""
    );
  });
  return lines.join("\n");
}

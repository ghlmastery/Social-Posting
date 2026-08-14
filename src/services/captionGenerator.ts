import { generateStructured } from "../lib/anthropic.js";
import type { GeneratedCaption, Platform } from "../types.js";

const SYSTEM_PROMPT = `You write social captions for a GoHighLevel-focused business:
niche = GoHighLevel software / SaaS agency tooling, business consulting, and coaching.
Voice: direct, practical, no fluff, speaks to agency owners and consultants.
You never invent specific stats, testimonials, or claims you weren't given.`;

interface CaptionSet {
  facebook: { body: string; hashtags: string[] };
  instagram: { body: string; hashtags: string[] };
  youtube: { title: string; body: string; hashtags: string[] };
}

const CAPTION_SCHEMA = {
  type: "object" as const,
  properties: {
    facebook: {
      type: "object",
      properties: { body: { type: "string" }, hashtags: { type: "array", items: { type: "string" } } },
      required: ["body", "hashtags"],
    },
    instagram: {
      type: "object",
      properties: { body: { type: "string" }, hashtags: { type: "array", items: { type: "string" } } },
      required: ["body", "hashtags"],
    },
    youtube: {
      type: "object",
      properties: {
        title: { type: "string" },
        body: { type: "string" },
        hashtags: { type: "array", items: { type: "string" } },
      },
      required: ["title", "body", "hashtags"],
    },
  },
  required: ["facebook", "instagram", "youtube"],
};

/**
 * Generates per-platform captions/titles for a video, from just its filename
 * (and optional extra context, e.g. a content idea it was recorded from).
 * Filenames are the only reliable signal we have for raw uploaded footage —
 * encourage descriptive filenames in docs/SETUP.md.
 */
export async function generateCaptions(
  videoFilename: string,
  extraContext?: string
): Promise<GeneratedCaption[]> {
  const prompt = `Video filename: "${videoFilename}"
${extraContext ? `Additional context: ${extraContext}` : ""}

Write captions for this video posting to Facebook, Instagram, and YouTube.
Rules:
- facebook.body: 1-3 short paragraphs, hook in the first line.
- instagram.body: punchier, line breaks, hook in the first line.
- youtube.title: under 70 characters, curiosity/benefit driven, no clickbait lies.
- youtube.body: a real description (2-4 sentences) plus a soft CTA.
- hashtags: 3-6 relevant, no banned/spammy tags, no leading # needed in the array values.`;

  const result = await generateStructured<CaptionSet>(SYSTEM_PROMPT, prompt, CAPTION_SCHEMA);

  const captions: GeneratedCaption[] = [
    { platform: "facebook", body: result.facebook.body, hashtags: result.facebook.hashtags },
    { platform: "instagram", body: result.instagram.body, hashtags: result.instagram.hashtags },
    {
      platform: "youtube",
      title: result.youtube.title,
      body: result.youtube.body,
      hashtags: result.youtube.hashtags,
    },
  ];
  return captions;
}

export function renderCaptionText(caption: GeneratedCaption): string {
  const tags = caption.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
  return [caption.body, tags].filter(Boolean).join("\n\n");
}

export function platformLabel(p: Platform): string {
  return { facebook: "Facebook", instagram: "Instagram", youtube: "YouTube" }[p];
}

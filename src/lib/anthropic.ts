import Anthropic from "@anthropic-ai/sdk";
import { config, required } from "../config.js";

let client: Anthropic | null = null;

function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: required("ANTHROPIC_API_KEY") });
  return client;
}

export async function generateText(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2000
): Promise<string> {
  const res = await anthropic().messages.create({
    model: config.anthropic.model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = res.content.find((b) => b.type === "text");
  return textBlock && textBlock.type === "text" ? textBlock.text : "";
}

/** Same as generateText but parses the response as JSON, with one repair retry. */
export async function generateJson<T>(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2000
): Promise<T> {
  const raw = await generateText(
    `${systemPrompt}\n\nRespond with ONLY valid JSON — no markdown fences, no commentary.`,
    userPrompt,
    maxTokens
  );
  try {
    return JSON.parse(raw) as T;
  } catch {
    const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error(`Claude did not return parseable JSON: ${raw.slice(0, 300)}`);
  }
}

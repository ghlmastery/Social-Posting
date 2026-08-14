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

/**
 * Structured output via tool-calling rather than asking Claude to emit raw
 * JSON text and parsing it: free-text JSON parsing breaks whenever a string
 * field contains a literal newline or unescaped quote (multi-paragraph
 * scripts hit this constantly). Forcing a tool call with an input_schema
 * makes the API itself responsible for producing a schema-conformant,
 * already-parsed object.
 */
export async function generateStructured<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: Anthropic.Tool.InputSchema,
  maxTokens = 2000
): Promise<T> {
  const res = await anthropic().messages.create({
    model: config.anthropic.model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    tools: [{ name: "submit_response", description: "Submit the structured response.", input_schema: schema }],
    tool_choice: { type: "tool", name: "submit_response" },
  });

  const toolUse = res.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a tool_use block for structured output.");
  }
  return toolUse.input as T;
}

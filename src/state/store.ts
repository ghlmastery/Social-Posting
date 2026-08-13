import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { config } from "../config.js";
import type { EngineState } from "../types.js";

const EMPTY_STATE: EngineState = {
  processedDriveFileIds: [],
  scheduledPosts: [],
  ideaHistory: [],
  competitorVideoIdsUsed: [],
  competitorScriptHistory: [],
  nextSlotCursor: 0,
};

/**
 * Flat JSON-file state store. Good enough for the run volumes here (one
 * process at a time, low write frequency). When running via GitHub Actions,
 * the workflow commits this file back to the repo after each job so state
 * survives across ephemeral runners — see docs/SETUP.md.
 */
export async function loadState(): Promise<EngineState> {
  try {
    const raw = await readFile(config.state.filePath, "utf-8");
    return { ...EMPTY_STATE, ...JSON.parse(raw) };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { ...EMPTY_STATE };
    }
    throw err;
  }
}

export async function saveState(state: EngineState): Promise<void> {
  await mkdir(dirname(config.state.filePath), { recursive: true });
  await writeFile(config.state.filePath, JSON.stringify(state, null, 2), "utf-8");
}

export async function withState<T>(
  fn: (state: EngineState) => Promise<T> | T
): Promise<T> {
  const state = await loadState();
  const result = await fn(state);
  await saveState(state);
  return result;
}

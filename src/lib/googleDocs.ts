import { docsClient } from "./googleAuth.js";

/** Flattens a Google Doc's structural content into plain text. */
export async function fetchDocAsPlainText(documentId: string): Promise<string> {
  const docs = docsClient();
  const res = await docs.documents.get({ documentId });
  const content = res.data.body?.content ?? [];

  const lines: string[] = [];
  for (const el of content) {
    const paragraph = el.paragraph;
    if (!paragraph?.elements) continue;
    let line = "";
    for (const pe of paragraph.elements) {
      line += pe.textRun?.content ?? "";
    }
    if (line.trim()) lines.push(line.replace(/\n$/, ""));
  }
  return lines.join("\n");
}

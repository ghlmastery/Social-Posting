import { driveClient } from "./googleAuth.js";
import type { DriveVideoFile } from "../types.js";

const VIDEO_MIME_PREFIX = "video/";

/**
 * Lists video files sitting directly in a Drive folder, newest first.
 * Google Drive doesn't require file extensions to match MIME type, so we
 * filter on mimeType rather than filename.
 */
export async function listVideosInFolder(folderId: string): Promise<DriveVideoFile[]> {
  const drive = driveClient();
  const files: DriveVideoFile[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and mimeType contains '${VIDEO_MIME_PREFIX}' and trashed = false`,
      fields: "nextPageToken, files(id, name, webViewLink, webContentLink, createdTime, mimeType, size)",
      orderBy: "createdTime asc",
      pageSize: 100,
      pageToken,
    });

    for (const f of res.data.files ?? []) {
      if (!f.id || !f.name || !f.createdTime || !f.mimeType) continue;
      files.push({
        id: f.id,
        name: f.name,
        webViewLink: f.webViewLink ?? `https://drive.google.com/file/d/${f.id}/view`,
        webContentLink: f.webContentLink ?? undefined,
        createdTime: f.createdTime,
        mimeType: f.mimeType,
        size: f.size ?? undefined,
      });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return files;
}

/** Makes a file readable via link, so GHL's servers can fetch it by URL. */
export async function ensurePubliclyReadable(fileId: string): Promise<void> {
  const drive = driveClient();
  const perms = await drive.permissions.list({ fileId, fields: "permissions(type,role)" });
  const alreadyPublic = perms.data.permissions?.some(
    (p) => p.type === "anyone" && (p.role === "reader" || p.role === "writer")
  );
  if (alreadyPublic) return;

  await drive.permissions.create({
    fileId,
    requestBody: { type: "anyone", role: "reader" },
  });
}

/** Direct-download URL that works once the file is publicly readable. */
export function driveDirectDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/** Writes a plain-text/markdown file into a Drive folder (used for generated ideas/scripts). */
export async function createTextFileInFolder(
  name: string,
  content: string,
  folderId: string
): Promise<string> {
  const drive = driveClient();
  const res = await drive.files.create({
    requestBody: { name, parents: [folderId], mimeType: "text/plain" },
    media: { mimeType: "text/plain", body: content },
    fields: "id",
  });
  if (!res.data.id) throw new Error(`Failed to create Drive file "${name}"`);
  return res.data.id;
}

export async function moveToFolder(
  fileId: string,
  targetFolderId: string,
  removeFromFolderId?: string
): Promise<void> {
  const drive = driveClient();
  await drive.files.update({
    fileId,
    addParents: targetFolderId,
    removeParents: removeFromFolderId,
    fields: "id, parents",
  });
}

import { google } from "googleapis";
import { config, required } from "../config.js";

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/documents.readonly",
];

let authClient: InstanceType<typeof google.auth.GoogleAuth> | null = null;

/**
 * Auth via a Google service account. Share your inbox/archive/output Drive
 * folders and the content-framework Doc with the service account's email
 * (found in the JSON key as `client_email`) as at least Viewer/Editor.
 */
export function getGoogleAuth() {
  if (authClient) return authClient;

  const b64 = required("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64");
  const credentials = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));

  authClient = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
  return authClient;
}

export function driveClient() {
  return google.drive({ version: "v3", auth: getGoogleAuth() as any });
}

export function docsClient() {
  return google.docs({ version: "v1", auth: getGoogleAuth() as any });
}

export function assertGoogleConfigured() {
  if (!config.google.serviceAccountJsonBase64) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 is not set — see docs/SETUP.md for how to create and encode a service account key."
    );
  }
}

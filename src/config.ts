import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

function csv(name: string): string[] {
  return optional(name)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const config = {
  anthropic: {
    apiKey: optional("ANTHROPIC_API_KEY"),
    model: optional("ANTHROPIC_MODEL", "claude-sonnet-5"),
  },
  ghl: {
    apiToken: optional("GHL_API_TOKEN"),
    locationId: optional("GHL_LOCATION_ID"),
    baseUrl: optional("GHL_API_BASE_URL", "https://services.leadconnectorhq.com"),
    apiVersion: optional("GHL_API_VERSION", "2021-07-28"),
    accounts: {
      facebook: optional("GHL_FACEBOOK_ACCOUNT_ID"),
      instagram: optional("GHL_INSTAGRAM_ACCOUNT_ID"),
      youtube: optional("GHL_YOUTUBE_ACCOUNT_ID"),
    },
  },
  google: {
    serviceAccountJsonBase64: optional("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64"),
    inboxFolderId: optional("GOOGLE_DRIVE_INBOX_FOLDER_ID"),
    archiveFolderId: optional("GOOGLE_DRIVE_ARCHIVE_FOLDER_ID"),
    outputFolderId: optional("GOOGLE_DRIVE_OUTPUT_FOLDER_ID"),
    frameworkDocId: optional(
      "CONTENT_FRAMEWORK_DOC_ID",
      "1asmHwaH9GraMqpYWlR5BdNngAty13OU5koiZktMj8kM"
    ),
  },
  youtube: {
    apiKey: optional("YOUTUBE_API_KEY"),
    nicheKeywords: csv("COMPETITOR_NICHE_KEYWORDS").length
      ? csv("COMPETITOR_NICHE_KEYWORDS")
      : [
          "GoHighLevel",
          "GoHighLevel agency",
          "GHL SaaS",
          "SaaS agency owner",
          "white label SaaS agency",
          "scale your marketing agency",
          "agency owner coaching",
          "consulting business for agencies",
        ],
    competitorChannels: csv("COMPETITOR_YOUTUBE_CHANNELS"),
    // Keeps broad keywords (e.g. "agency owner coaching") from matching
    // unrelated-language/region content that happens to share those words.
    relevanceLanguage: optional("YOUTUBE_RELEVANCE_LANGUAGE", "en"),
    regionCode: optional("YOUTUBE_REGION_CODE", "US"),
  },
  fathom: {
    apiKey: optional("FATHOM_API_KEY"),
    baseUrl: optional("FATHOM_API_BASE_URL", "https://api.fathom.ai/external/v1"),
    // Fathom workspace doesn't (yet) separate coaching/client calls from
    // internal meetings by team/tag, so this is the stand-in filter: a
    // meeting where every attendee is on one of these domains is treated as
    // internal and excluded. Leave empty to disable the filter entirely.
    internalEmailDomains: csv("FATHOM_INTERNAL_EMAIL_DOMAINS"),
    lookbackDays: Number(optional("FATHOM_LOOKBACK_DAYS", "7")),
    // Off by default: call summaries + action items are enough signal for
    // theme extraction, and skipping raw transcripts keeps less verbatim
    // client PII in play. Flip on only if summaries prove too thin.
    includeTranscript: optional("FATHOM_INCLUDE_TRANSCRIPT", "false").toLowerCase() === "true",
  },
  posting: {
    timezone: optional("POSTING_TIMEZONE", "America/Toronto"),
    slotTimes: csv("POSTING_SLOT_TIMES").length
      ? csv("POSTING_SLOT_TIMES")
      : ["09:00", "13:00", "17:00"],
  },
  state: {
    filePath: optional("STATE_FILE_PATH", "./data/state.json"),
  },
  dryRun: optional("DRY_RUN", "true").toLowerCase() !== "false",
};

export { required };

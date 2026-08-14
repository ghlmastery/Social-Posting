export type Platform = "facebook" | "instagram" | "youtube";

export interface DriveVideoFile {
  id: string;
  name: string;
  webViewLink: string;
  webContentLink?: string;
  createdTime: string;
  mimeType: string;
  size?: string;
}

export interface GeneratedCaption {
  platform: Platform;
  title?: string; // YouTube needs a distinct title
  body: string; // caption / description
  hashtags: string[];
}

export interface ScheduledPostRecord {
  driveFileId: string;
  driveFileName: string;
  platform: Platform;
  ghlPostId: string | null;
  scheduledFor: string; // ISO timestamp
  createdAt: string;
  dryRun: boolean;
}

export interface ContentIdea {
  id: string;
  title: string;
  hook: string;
  angle: string;
  format: string;
  frameworkPillar: string;
  createdAt: string;
}

export interface CompetitorVideo {
  videoId: string;
  channelTitle: string;
  title: string;
  url: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  viewsPerDay: number;
  description: string;
}

export interface CompetitorScriptPackage {
  sourceVideo: CompetitorVideo;
  whyItWorks: string;
  uniqueScript: string;
  suggestedHook: string;
  suggestedCta: string;
  createdAt: string;
}

export interface FathomMeeting {
  id: string;
  title: string;
  url: string;
  createdAt: string;
  attendeeEmails: string[];
  summary?: string;
  actionItems?: string[];
}

export interface CallInsight {
  id: string;
  theme: string;
  description: string;
  contentAngle: string;
  mentionCount: number;
  createdAt: string;
}

export interface EngineState {
  processedDriveFileIds: string[];
  scheduledPosts: ScheduledPostRecord[];
  ideaHistory: ContentIdea[];
  competitorVideoIdsUsed: string[];
  competitorScriptHistory: CompetitorScriptPackage[];
  nextSlotCursor: number;
  fathomLastSyncedAt: string | null;
  processedFathomMeetingIds: string[];
  callInsightHistory: CallInsight[];
}

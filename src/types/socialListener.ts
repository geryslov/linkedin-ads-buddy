// ─── Tracked Profiles ───────────────────────────────────────────────────────

export type SocialPlatform = 'linkedin' | 'twitter' | 'instagram';

export interface TrackedProfile {
  id: string; // uuid
  platform: SocialPlatform;
  url: string;
  handle: string; // e.g. "satyanadella"
  displayName?: string;
  avatarUrl?: string;
  addedAt: string; // ISO
}

// ─── Apify Run ───────────────────────────────────────────────────────────────

export type RunStatus = 'idle' | 'running' | 'succeeded' | 'failed' | 'timed-out';

export interface ScrapeRun {
  id: string; // Apify run ID
  profileIds: string[]; // TrackedProfile IDs included
  platform: SocialPlatform;
  actorId: string;
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  itemCount?: number;
}

// ─── Post Data ───────────────────────────────────────────────────────────────

export interface ReactionBreakdown {
  LIKE?: number;
  PRAISE?: number;
  APPRECIATION?: number;
  EMPATHY?: number;
  INTEREST?: number;
  ENTERTAINMENT?: number;
  [key: string]: number | undefined;
}

export interface PostAuthor {
  name: string;
  profileUrl?: string;
  headline?: string;
  avatarUrl?: string;
}

export interface SocialPost {
  id: string;
  platform: SocialPlatform;
  profileHandle: string; // maps to TrackedProfile.handle
  profileId: string; // TrackedProfile.id
  url: string;
  text: string;
  postedAt: string; // ISO
  likes: number;
  comments: number;
  reposts: number;
  totalReactions: number;
  reactionBreakdown: ReactionBreakdown;
  isRepost: boolean;
  isQuotePost: boolean;
  hasMedia: boolean;
  mediaType?: 'image' | 'video' | 'document' | 'link';
  author: PostAuthor;
  // Raw for drill-down
  raw?: Record<string, unknown>;
}

// ─── Analytics helpers ───────────────────────────────────────────────────────

export interface ProfileStats {
  profileId: string;
  handle: string;
  displayName: string;
  platform: SocialPlatform;
  postCount: number;
  totalReactions: number;
  totalComments: number;
  totalReposts: number;
  avgEngagement: number; // (reactions+comments+reposts)/posts
  topPost?: SocialPost;
  lastPostedAt?: string;
  postsPerWeek: number;
}

export interface MacroStats {
  totalProfiles: number;
  totalPosts: number;
  totalReactions: number;
  totalComments: number;
  totalReposts: number;
  avgEngagementRate: number;
  mostActiveProfile?: ProfileStats;
  topPost?: SocialPost;
  postsOverTime: { date: string; count: number; reactions: number }[];
  reactionBreakdown: ReactionBreakdown;
  platformBreakdown: { platform: SocialPlatform; posts: number }[];
  contentTypeBreakdown: { type: string; count: number }[];
}

// ─── Apify Actor Config ───────────────────────────────────────────────────────

export const APIFY_ACTORS = {
  linkedin_profile_posts: 'A3cAPGpwBEG8RJwse', // harvestapi — primary
  twitter_tweets: '61RPP7dywgiy0JPD0', // apidojo/tweet-scraper-v2
  instagram_posts: 'shu8hvrXbJbY3Eb9W', // apify/instagram-scraper
} as const;

export type ApifyActorKey = keyof typeof APIFY_ACTORS;

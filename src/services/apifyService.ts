import type {
  SocialPost,
  SocialPlatform,
  TrackedProfile,
  ScrapeRun,
  ReactionBreakdown,
} from '@/types/socialListener';
import { APIFY_ACTORS } from '@/types/socialListener';

import { supabase } from '@/integrations/supabase/client';

// ─── Low-level helpers ────────────────────────────────────────────────────────

async function apifyFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const method = options?.method ?? 'GET';
  const body = options?.body ? JSON.parse(options.body as string) : undefined;

  const { data, error } = await supabase.functions.invoke('apify-proxy', {
    body: { path, method, body },
  });

  if (error) {
    throw new Error(`Apify proxy error: ${error.message}`);
  }

  return data as T;
}

// ─── Run an actor and return its run ID ───────────────────────────────────────

export async function startActorRun(
  actorId: string,
  input: Record<string, unknown>,
): Promise<string> {
  const data = await apifyFetch<{ data: { id: string } }>(
    `/acts/${actorId}/runs`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  return data.data.id;
}

// ─── Poll run status ──────────────────────────────────────────────────────────

export async function getRunStatus(
  runId: string,
): Promise<{ status: string; defaultDatasetId: string; itemCount: number }> {
  const data = await apifyFetch<{
    data: {
      status: string;
      defaultDatasetId: string;
      stats: { itemCount: number };
    };
  }>(`/actor-runs/${runId}`);
  return {
    status: data.data.status,
    defaultDatasetId: data.data.defaultDatasetId,
    itemCount: data.data.stats?.itemCount ?? 0,
  };
}

// ─── Fetch dataset items ──────────────────────────────────────────────────────

export async function fetchDataset<T>(
  datasetId: string,
  limit = 1000,
): Promise<T[]> {
  const data = await apifyFetch<{ items: T[] }>(
    `/datasets/${datasetId}/items?limit=${limit}&clean=true`,
  );
  return data.items ?? [];
}

// ─── Poll until done (max 10 min) ─────────────────────────────────────────────

export async function waitForRun(
  runId: string,
  onProgress?: (status: string, items: number) => void,
): Promise<{ datasetId: string; itemCount: number }> {
  const TERMINAL = ['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'];
  const INTERVAL = 3000; // 3s
  const MAX_ATTEMPTS = 200; // 10 min

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, INTERVAL));
    const { status, defaultDatasetId, itemCount } = await getRunStatus(runId);
    onProgress?.(status, itemCount);
    if (TERMINAL.includes(status)) {
      if (status !== 'SUCCEEDED') throw new Error(`Run ended with status: ${status}`);
      return { datasetId: defaultDatasetId, itemCount };
    }
  }
  throw new Error('Run timed out waiting for completion');
}

// ─── LinkedIn Profile Posts ────────────────────────────────────────────────────

interface LinkedInPostRaw {
  postUrl?: string;
  url?: string;
  text?: string;
  postContent?: string;
  content?: string;
  postedAt?: string;
  publishedAt?: string;
  timestamp?: string;
  date?: string;
  reactionsCount?: number;
  totalReactionCount?: number;
  likesCount?: number;
  likes?: number;
  commentsCount?: number;
  comments?: number;
  repostsCount?: number;
  reposts?: number;
  reactions?: ReactionBreakdown;
  reactionTypeCounts?: ReactionBreakdown;
  isRepost?: boolean;
  isQuotePost?: boolean;
  media?: unknown[];
  mediaType?: string;
  author?: {
    name?: string;
    profileUrl?: string;
    headline?: string;
    pictureUrl?: string;
  };
  authorName?: string;
  authorProfileUrl?: string;
}

function normalizeLinkedInPost(
  raw: LinkedInPostRaw,
  profile: TrackedProfile,
): SocialPost {
  const text = raw.text ?? raw.postContent ?? raw.content ?? '';
  const postedAt =
    raw.postedAt ?? raw.publishedAt ?? raw.timestamp ?? raw.date ?? new Date().toISOString();
  const reactions =
    raw.reactionsCount ?? raw.totalReactionCount ?? raw.likesCount ?? raw.likes ?? 0;
  const comments = raw.commentsCount ?? raw.comments ?? 0;
  const reposts = raw.repostsCount ?? raw.reposts ?? 0;
  const reactionBreakdown: ReactionBreakdown =
    raw.reactions ?? raw.reactionTypeCounts ?? {};

  const authorRaw = raw.author ?? {};
  const author = {
    name: authorRaw.name ?? raw.authorName ?? profile.displayName ?? profile.handle,
    profileUrl: authorRaw.profileUrl ?? raw.authorProfileUrl ?? profile.url,
    headline: authorRaw.headline,
    avatarUrl: authorRaw.pictureUrl ?? profile.avatarUrl,
  };

  const hasMedia = Array.isArray(raw.media) ? raw.media.length > 0 : false;

  return {
    id: `li_${profile.id}_${raw.postUrl ?? raw.url ?? Math.random().toString(36).slice(2)}`,
    platform: 'linkedin',
    profileHandle: profile.handle,
    profileId: profile.id,
    url: raw.postUrl ?? raw.url ?? profile.url,
    text,
    postedAt,
    likes: reactions,
    comments,
    reposts,
    totalReactions: reactions,
    reactionBreakdown,
    isRepost: raw.isRepost ?? false,
    isQuotePost: raw.isQuotePost ?? false,
    hasMedia,
    mediaType: raw.mediaType as SocialPost['mediaType'],
    author,
    raw: raw as Record<string, unknown>,
  };
}

export async function scrapeLinkedInProfiles(
  profiles: TrackedProfile[],
  options: {
    maxPosts?: number;
    postedLimit?: string;
    scrapeReactions?: boolean;
    scrapeComments?: boolean;
    maxComments?: number;
    includeReposts?: boolean;
    includeQuotePosts?: boolean;
  } = {},
  onProgress?: (status: string, items: number) => void,
): Promise<{ posts: SocialPost[]; run: Partial<ScrapeRun> }> {
  const targetUrls = profiles.map((p) => p.url);

  const input = {
    targetUrls,
    maxPosts: options.maxPosts ?? 20,
    postedLimit: options.postedLimit ?? 'month',
    scrapeReactions: options.scrapeReactions ?? false,
    scrapeComments: options.scrapeComments ?? false,
    maxComments: options.maxComments ?? 5,
    includeReposts: options.includeReposts ?? true,
    includeQuotePosts: options.includeQuotePosts ?? true,
  };

  const runId = await startActorRun(APIFY_ACTORS.linkedin_profile_posts, input);
  onProgress?.('RUNNING', 0);

  const { datasetId, itemCount } = await waitForRun(runId, onProgress);
  const rawItems = await fetchDataset<LinkedInPostRaw>(datasetId, 5000);

  // Map each item to a profile by matching URL/handle
  const posts: SocialPost[] = rawItems.map((raw) => {
    // Try to match author URL to a profile
    const authorUrl = raw.author?.profileUrl ?? raw.authorProfileUrl ?? '';
    const matched =
      profiles.find(
        (p) =>
          authorUrl.includes(p.handle) ||
          (raw.postUrl ?? raw.url ?? '').includes(p.handle),
      ) ?? profiles[0];
    return normalizeLinkedInPost(raw, matched);
  });

  return {
    posts,
    run: {
      id: runId,
      actorId: APIFY_ACTORS.linkedin_profile_posts,
      platform: 'linkedin',
      status: 'succeeded',
      itemCount,
    },
  };
}

// ─── Twitter / X ──────────────────────────────────────────────────────────────

interface TwitterPostRaw {
  id?: string;
  full_text?: string;
  text?: string;
  created_at?: string;
  retweet_count?: number;
  favorite_count?: number;
  reply_count?: number;
  quote_count?: number;
  url?: string;
  is_retweet?: boolean;
  is_quote?: boolean;
  user?: { screen_name?: string; name?: string; profile_image_url?: string };
}

function normalizeTwitterPost(raw: TwitterPostRaw, profile: TrackedProfile): SocialPost {
  return {
    id: `tw_${profile.id}_${raw.id ?? Math.random().toString(36).slice(2)}`,
    platform: 'twitter',
    profileHandle: profile.handle,
    profileId: profile.id,
    url: raw.url ?? `https://twitter.com/${profile.handle}`,
    text: raw.full_text ?? raw.text ?? '',
    postedAt: raw.created_at ?? new Date().toISOString(),
    likes: raw.favorite_count ?? 0,
    comments: raw.reply_count ?? 0,
    reposts: raw.retweet_count ?? 0,
    totalReactions: raw.favorite_count ?? 0,
    reactionBreakdown: { LIKE: raw.favorite_count ?? 0 },
    isRepost: raw.is_retweet ?? false,
    isQuotePost: raw.is_quote ?? false,
    hasMedia: false,
    author: {
      name: raw.user?.name ?? profile.displayName ?? profile.handle,
      profileUrl: profile.url,
      avatarUrl: raw.user?.profile_image_url ?? profile.avatarUrl,
    },
    raw: raw as Record<string, unknown>,
  };
}

export async function scrapeTwitterProfiles(
  profiles: TrackedProfile[],
  options: { maxTweets?: number } = {},
  onProgress?: (status: string, items: number) => void,
): Promise<{ posts: SocialPost[]; run: Partial<ScrapeRun> }> {
  const handles = profiles.map((p) => p.handle.replace('@', ''));

  const input = {
    startUrls: handles.map((h) => ({ url: `https://twitter.com/${h}` })),
    maxItems: options.maxTweets ?? 50,
  };

  const runId = await startActorRun(APIFY_ACTORS.twitter_tweets, input);
  onProgress?.('RUNNING', 0);

  const { datasetId, itemCount } = await waitForRun(runId, onProgress);
  const rawItems = await fetchDataset<TwitterPostRaw>(datasetId, 5000);

  const posts: SocialPost[] = rawItems.map((raw) => {
    const screenName = raw.user?.screen_name ?? '';
    const matched =
      profiles.find((p) => p.handle.toLowerCase().includes(screenName.toLowerCase())) ??
      profiles[0];
    return normalizeTwitterPost(raw, matched);
  });

  return {
    posts,
    run: {
      id: runId,
      actorId: APIFY_ACTORS.twitter_tweets,
      platform: 'twitter',
      status: 'succeeded',
      itemCount,
    },
  };
}

// ─── Instagram ────────────────────────────────────────────────────────────────

interface InstagramPostRaw {
  id?: string;
  caption?: string;
  timestamp?: string;
  likesCount?: number;
  commentsCount?: number;
  url?: string;
  type?: string;
  ownerUsername?: string;
  ownerFullName?: string;
  displayUrl?: string;
}

function normalizeInstagramPost(raw: InstagramPostRaw, profile: TrackedProfile): SocialPost {
  return {
    id: `ig_${profile.id}_${raw.id ?? Math.random().toString(36).slice(2)}`,
    platform: 'instagram',
    profileHandle: profile.handle,
    profileId: profile.id,
    url: raw.url ?? profile.url,
    text: raw.caption ?? '',
    postedAt: raw.timestamp ?? new Date().toISOString(),
    likes: raw.likesCount ?? 0,
    comments: raw.commentsCount ?? 0,
    reposts: 0,
    totalReactions: raw.likesCount ?? 0,
    reactionBreakdown: { LIKE: raw.likesCount ?? 0 },
    isRepost: false,
    isQuotePost: false,
    hasMedia: true,
    mediaType: (raw.type === 'Video' ? 'video' : 'image') as SocialPost['mediaType'],
    author: {
      name: raw.ownerFullName ?? profile.displayName ?? profile.handle,
      profileUrl: profile.url,
    },
    raw: raw as Record<string, unknown>,
  };
}

export async function scrapeInstagramProfiles(
  profiles: TrackedProfile[],
  options: { maxPosts?: number } = {},
  onProgress?: (status: string, items: number) => void,
): Promise<{ posts: SocialPost[]; run: Partial<ScrapeRun> }> {
  const input = {
    directUrls: profiles.map((p) => p.url),
    resultsType: 'posts',
    resultsLimit: options.maxPosts ?? 30,
  };

  const runId = await startActorRun(APIFY_ACTORS.instagram_posts, input);
  onProgress?.('RUNNING', 0);

  const { datasetId, itemCount } = await waitForRun(runId, onProgress);
  const rawItems = await fetchDataset<InstagramPostRaw>(datasetId, 5000);

  const posts: SocialPost[] = rawItems.map((raw) => {
    const username = raw.ownerUsername ?? '';
    const matched =
      profiles.find((p) => p.handle.toLowerCase() === username.toLowerCase()) ??
      profiles[0];
    return normalizeInstagramPost(raw, matched);
  });

  return {
    posts,
    run: {
      id: runId,
      actorId: APIFY_ACTORS.instagram_posts,
      platform: 'instagram',
      status: 'succeeded',
      itemCount,
    },
  };
}

// ─── Unified scrape entry ─────────────────────────────────────────────────────

export async function scrapeProfiles(
  profiles: TrackedProfile[],
  options: {
    maxPostsPerProfile?: number;
    postedLimit?: string;
    scrapeReactions?: boolean;
    scrapeComments?: boolean;
    includeReposts?: boolean;
    includeQuotePosts?: boolean;
  } = {},
  onProgress?: (platform: SocialPlatform, status: string, items: number) => void,
): Promise<SocialPost[]> {
  const byPlatform = profiles.reduce(
    (acc, p) => {
      if (!acc[p.platform]) acc[p.platform] = [];
      acc[p.platform].push(p);
      return acc;
    },
    {} as Record<SocialPlatform, TrackedProfile[]>,
  );

  const results: SocialPost[] = [];

  for (const [platform, pProfiles] of Object.entries(byPlatform) as [
    SocialPlatform,
    TrackedProfile[],
  ][]) {
    try {
      if (platform === 'linkedin') {
        const { posts } = await scrapeLinkedInProfiles(
          pProfiles,
          {
            maxPosts: options.maxPostsPerProfile ?? 20,
            postedLimit: options.postedLimit ?? 'month',
            scrapeReactions: options.scrapeReactions,
            scrapeComments: options.scrapeComments,
            includeReposts: options.includeReposts,
            includeQuotePosts: options.includeQuotePosts,
          },
          (status, items) => onProgress?.(platform, status, items),
        );
        results.push(...posts);
      } else if (platform === 'twitter') {
        const { posts } = await scrapeTwitterProfiles(
          pProfiles,
          { maxTweets: options.maxPostsPerProfile ?? 50 },
          (status, items) => onProgress?.(platform, status, items),
        );
        results.push(...posts);
      } else if (platform === 'instagram') {
        const { posts } = await scrapeInstagramProfiles(
          pProfiles,
          { maxPosts: options.maxPostsPerProfile ?? 30 },
          (status, items) => onProgress?.(platform, status, items),
        );
        results.push(...posts);
      }
    } catch (err) {
      console.error(`Failed to scrape ${platform}:`, err);
    }
  }

  return results;
}

// ─── Apify store search ───────────────────────────────────────────────────────

export interface ApifyStoreActor {
  id: string;
  title: string;
  name: string;
  username: string;
  url: string;
  categories: string[];
  stats: { totalRuns: number; actorReviewRating: number };
}

export async function searchApifyStore(
  query: string,
  limit = 10,
): Promise<ApifyStoreActor[]> {
  const data = await apifyFetch<{ data: { items: ApifyStoreActor[] } }>(
    `/store?search=${encodeURIComponent(query)}&limit=${limit}&category=SOCIAL_MEDIA`,
  );
  return data.data?.items ?? [];
}

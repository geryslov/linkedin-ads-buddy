import type {
  SocialPost,
  SocialPlatform,
  TrackedProfile,
  ScrapeRun,
  ReactionBreakdown,
  ReactorProfile,
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
  const data = await apifyFetch<T[] | { items: T[] }>(
    `/datasets/${datasetId}/items?limit=${limit}&clean=true`,
  );
  // Apify returns a plain array; handle both formats defensively
  if (Array.isArray(data)) return data;
  return (data as { items: T[] }).items ?? [];
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
  id?: string;
  postUrl?: string;
  url?: string;
  linkedinUrl?: string;
  text?: string;
  postContent?: string;
  content?: string;
  postedAt?:
    | string
    | {
        timestamp?: number;
        date?: string;
        postedAgoShort?: string;
        postedAgoText?: string;
      }
    | null;
  publishedAt?: string;
  timestamp?: string | number;
  date?: string;
  reactionsCount?: number;
  totalReactionCount?: number;
  likesCount?: number;
  likes?: number;
  commentsCount?: number;
  comments?: number;
  repostsCount?: number;
  reposts?: number;
  reactions?: ReactionBreakdown | Array<{ type?: string; count?: number }>;
  reactionTypeCounts?: ReactionBreakdown;
  engagement?: {
    likes?: number;
    comments?: number;
    shares?: number;
    reactions?: Array<{ type?: string; count?: number }>;
  };
  isRepost?: boolean;
  isQuotePost?: boolean;
  media?: unknown[];
  postImages?: unknown[];
  postVideo?: unknown;
  document?: unknown;
  mediaType?: string;
  author?: {
    name?: string;
    profileUrl?: string;
    linkedinUrl?: string;
    headline?: string;
    info?: string;
    pictureUrl?: string;
    avatar?: {
      url?: string;
    };
  };
  authorName?: string;
  authorProfileUrl?: string;
}

function toIsoDate(value: unknown): string {
  const fallback = new Date().toISOString();

  if (!value) return fallback;

  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
  }

  if (typeof value === 'object') {
    const obj = value as { date?: string; timestamp?: number };
    if (obj.date) {
      const d = new Date(obj.date);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
    if (typeof obj.timestamp === 'number') {
      const d = new Date(obj.timestamp);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
  }

  return fallback;
}

function normalizeReactionBreakdown(raw: LinkedInPostRaw): ReactionBreakdown {
  if (raw.reactionTypeCounts) return raw.reactionTypeCounts;

  if (raw.reactions && !Array.isArray(raw.reactions)) {
    return raw.reactions;
  }

  const list =
    raw.engagement?.reactions ?? (Array.isArray(raw.reactions) ? raw.reactions : []);

  return list.reduce((acc, item) => {
    if (!item?.type) return acc;
    acc[item.type] = (acc[item.type] ?? 0) + (item.count ?? 0);
    return acc;
  }, {} as ReactionBreakdown);
}

function normalizeLinkedInPost(
  raw: LinkedInPostRaw,
  profile: TrackedProfile,
): SocialPost {
  const text = raw.text ?? raw.postContent ?? raw.content ?? '';
  const postedAt = toIsoDate(
    raw.postedAt ?? raw.publishedAt ?? raw.timestamp ?? raw.date,
  );

  const reactionBreakdown = normalizeReactionBreakdown(raw);
  const reactionsFromBreakdown = Object.values(reactionBreakdown).reduce(
    (sum, count) => sum + (count ?? 0),
    0,
  );

  const reactions =
    raw.reactionsCount ??
    raw.totalReactionCount ??
    raw.likesCount ??
    raw.likes ??
    raw.engagement?.likes ??
    reactionsFromBreakdown;
  const comments = raw.commentsCount ?? raw.comments ?? raw.engagement?.comments ?? 0;
  const reposts = raw.repostsCount ?? raw.reposts ?? raw.engagement?.shares ?? 0;

  const authorRaw = raw.author ?? {};
  const author = {
    name: authorRaw.name ?? raw.authorName ?? profile.displayName ?? profile.handle,
    profileUrl:
      authorRaw.profileUrl ??
      authorRaw.linkedinUrl ??
      raw.authorProfileUrl ??
      profile.url,
    headline: authorRaw.headline ?? authorRaw.info,
    avatarUrl: authorRaw.pictureUrl ?? authorRaw.avatar?.url ?? profile.avatarUrl,
  };

  const hasMedia =
    (Array.isArray(raw.media) && raw.media.length > 0) ||
    (Array.isArray(raw.postImages) && raw.postImages.length > 0) ||
    Boolean(raw.postVideo) ||
    Boolean(raw.document);

  const mediaType =
    raw.mediaType ??
    (raw.postVideo ? 'video' : undefined) ??
    (Array.isArray(raw.postImages) && raw.postImages.length > 0 ? 'image' : undefined) ??
    (raw.document ? 'document' : undefined);

  const postUrl = raw.postUrl ?? raw.url ?? raw.linkedinUrl ?? profile.url;

  return {
    id: `li_${profile.id}_${raw.id ?? postUrl ?? Math.random().toString(36).slice(2)}`,
    platform: 'linkedin',
    profileHandle: profile.handle,
    profileId: profile.id,
    url: postUrl,
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
    mediaType: mediaType as SocialPost['mediaType'],
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

  interface DatasetItem extends LinkedInPostRaw {
    type?: string;
    actor?: {
      id?: string;
      name?: string;
      linkedinUrl?: string;
      position?: string;
      pictureUrl?: string;
      picture?: { url?: string };
    };
    reactionType?: string;
    postId?: string;
  }

  const allItems = await fetchDataset<DatasetItem>(datasetId, 5000);

  // Separate posts from reactions
  const rawPosts = allItems.filter((item) => item.type !== 'reaction');
  const rawReactions = allItems.filter((item) => item.type === 'reaction');

  // Build reactor profiles grouped by postId
  const reactorsByPostId = new Map<string, ReactorProfile[]>();
  for (const r of rawReactions) {
    if (!r.postId || !r.actor) continue;
    const reactor: ReactorProfile = {
      id: r.actor.id ?? '',
      name: r.actor.name ?? 'Unknown',
      linkedinUrl: r.actor.linkedinUrl,
      position: r.actor.position,
      pictureUrl: r.actor.pictureUrl ?? r.actor.picture?.url,
      reactionType: r.reactionType ?? 'LIKE',
      postId: r.postId,
    };
    const existing = reactorsByPostId.get(r.postId) ?? [];
    existing.push(reactor);
    reactorsByPostId.set(r.postId, existing);
  }

  // Map each post item to a profile by matching URL/handle
  const posts: SocialPost[] = rawPosts.map((raw) => {
    const authorUrl =
      raw.author?.profileUrl ?? raw.author?.linkedinUrl ?? raw.authorProfileUrl ?? '';
    const postUrl = raw.postUrl ?? raw.url ?? raw.linkedinUrl ?? '';
    const matched =
      profiles.find(
        (p) => authorUrl.includes(p.handle) || postUrl.includes(p.handle),
      ) ?? profiles[0];
    const post = normalizeLinkedInPost(raw, matched);

    // Attach reactor profiles using entityId or shareUrn
    const entityId = (raw as Record<string, unknown>).entityId as string | undefined;
    const shareUrn = (raw as Record<string, unknown>).shareUrn as string | undefined;
    const reactors =
      reactorsByPostId.get(entityId ?? '') ??
      reactorsByPostId.get(shareUrn ?? '') ??
      [];
    if (reactors.length > 0) {
      post.reactors = reactors;
    }

    return post;
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

interface ApifyActorRun {
  id: string;
  status: string;
  defaultDatasetId?: string;
  input?: Record<string, unknown>;
}

function normalizeProfileUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, '');
}

function extractInputUrls(input?: Record<string, unknown>): string[] {
  if (!input) return [];

  const i = input as {
    targetUrls?: unknown;
    directUrls?: unknown;
    startUrls?: unknown;
  };

  const targetUrls = Array.isArray(i.targetUrls)
    ? i.targetUrls.filter((u): u is string => typeof u === 'string')
    : [];

  const directUrls = Array.isArray(i.directUrls)
    ? i.directUrls.filter((u): u is string => typeof u === 'string')
    : [];

  const startUrls = Array.isArray(i.startUrls)
    ? i.startUrls
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null;
          const url = (entry as { url?: unknown }).url;
          return typeof url === 'string' ? url : null;
        })
        .filter((u): u is string => Boolean(u))
    : [];

  return [...new Set([...targetUrls, ...directUrls, ...startUrls])];
}

function runUrlMatchesProfile(url: string, profile: TrackedProfile): boolean {
  const normalizedRunUrl = normalizeProfileUrl(url);
  const normalizedProfileUrl = normalizeProfileUrl(profile.url);
  const handle = profile.handle.replace('@', '').toLowerCase();

  return (
    normalizedRunUrl === normalizedProfileUrl ||
    normalizedRunUrl.includes(`/${handle}`) ||
    normalizedRunUrl.includes(handle)
  );
}

export async function recoverLatestLinkedInRun(
  profiles: TrackedProfile[],
): Promise<SocialPost[]> {
  const linkedinProfiles = profiles.filter((p) => p.platform === 'linkedin');
  if (linkedinProfiles.length === 0) return [];

  const runData = await apifyFetch<{ data: { items: ApifyActorRun[] } }>(
    `/acts/${APIFY_ACTORS.linkedin_profile_posts}/runs?status=SUCCEEDED&desc=1&limit=20`,
  );

  const runs = runData.data?.items ?? [];

  for (const run of runs) {
    if (!run.defaultDatasetId) continue;

    const runUrls = extractInputUrls(run.input);
    if (runUrls.length > 0) {
      const hasProfileMatch = linkedinProfiles.some((profile) =>
        runUrls.some((url) => runUrlMatchesProfile(url, profile)),
      );
      if (!hasProfileMatch) continue;
    }

    const rawItems = await fetchDataset<LinkedInPostRaw>(run.defaultDatasetId, 5000);
    if (rawItems.length === 0) continue;

    return rawItems.map((raw) => {
      const authorUrl =
        raw.author?.profileUrl ?? raw.author?.linkedinUrl ?? raw.authorProfileUrl ?? '';
      const postUrl = raw.postUrl ?? raw.url ?? raw.linkedinUrl ?? '';

      const matched =
        linkedinProfiles.find(
          (profile) =>
            runUrlMatchesProfile(authorUrl, profile) || runUrlMatchesProfile(postUrl, profile),
        ) ?? linkedinProfiles[0];

      return normalizeLinkedInPost(raw, matched);
    });
  }

  return [];
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

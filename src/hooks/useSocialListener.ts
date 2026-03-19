import { useState, useCallback, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { scrapeProfiles } from '@/services/apifyService';
import type {
  TrackedProfile,
  SocialPost,
  ScrapeRun,
  SocialPlatform,
  MacroStats,
  ProfileStats,
  ReactionBreakdown,
} from '@/types/socialListener';
import { format, parseISO, subDays, eachDayOfInterval, startOfDay } from 'date-fns';

const PROFILES_KEY = 'sl_profiles';
const POSTS_KEY = 'sl_posts';
const RUNS_KEY = 'sl_runs';

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ─── Analytics derivation ────────────────────────────────────────────────────

function deriveProfileStats(profile: TrackedProfile, posts: SocialPost[]): ProfileStats {
  const mine = posts.filter((p) => p.profileId === profile.id);
  const totalReactions = mine.reduce((s, p) => s + p.totalReactions, 0);
  const totalComments = mine.reduce((s, p) => s + p.comments, 0);
  const totalReposts = mine.reduce((s, p) => s + p.reposts, 0);
  const avgEngagement = mine.length
    ? (totalReactions + totalComments + totalReposts) / mine.length
    : 0;
  const topPost = [...mine].sort(
    (a, b) => b.totalReactions + b.comments - (a.totalReactions + a.comments),
  )[0];
  const sorted = [...mine].sort(
    (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
  );
  const lastPostedAt = sorted[0]?.postedAt;

  // Posts per week: posts in last 28d / 4
  const cutoff = subDays(new Date(), 28);
  const recent = mine.filter((p) => new Date(p.postedAt) >= cutoff);
  const postsPerWeek = recent.length / 4;

  return {
    profileId: profile.id,
    handle: profile.handle,
    displayName: profile.displayName ?? profile.handle,
    platform: profile.platform,
    postCount: mine.length,
    totalReactions,
    totalComments,
    totalReposts,
    avgEngagement: Math.round(avgEngagement * 10) / 10,
    topPost,
    lastPostedAt,
    postsPerWeek: Math.round(postsPerWeek * 10) / 10,
  };
}

function deriveMacroStats(
  profiles: TrackedProfile[],
  posts: SocialPost[],
): MacroStats {
  const totalReactions = posts.reduce((s, p) => s + p.totalReactions, 0);
  const totalComments = posts.reduce((s, p) => s + p.comments, 0);
  const totalReposts = posts.reduce((s, p) => s + p.reposts, 0);
  const avgEngagementRate = posts.length
    ? (totalReactions + totalComments + totalReposts) / posts.length
    : 0;

  const profileStatsList = profiles.map((p) => deriveProfileStats(p, posts));
  const mostActiveProfile = [...profileStatsList].sort(
    (a, b) => b.postCount - a.postCount,
  )[0];

  const topPost = [...posts].sort(
    (a, b) => b.totalReactions + b.comments - (a.totalReactions + a.comments),
  )[0];

  // Posts over time (last 30 days)
  const days = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() });
  const postsOverTime = days.map((day) => {
    const key = format(day, 'MMM d');
    const dayPosts = posts.filter(
      (p) =>
        format(startOfDay(parseISO(p.postedAt)), 'MMM d') === key,
    );
    return {
      date: key,
      count: dayPosts.length,
      reactions: dayPosts.reduce((s, p) => s + p.totalReactions, 0),
    };
  });

  // Reaction breakdown aggregate
  const reactionBreakdown: ReactionBreakdown = {};
  for (const post of posts) {
    for (const [k, v] of Object.entries(post.reactionBreakdown)) {
      reactionBreakdown[k] = (reactionBreakdown[k] ?? 0) + (v ?? 0);
    }
  }

  // Platform breakdown
  const platformMap = new Map<SocialPlatform, number>();
  for (const p of posts) {
    platformMap.set(p.platform, (platformMap.get(p.platform) ?? 0) + 1);
  }
  const platformBreakdown = [...platformMap.entries()].map(([platform, count]) => ({
    platform,
    posts: count,
  }));

  // Content type breakdown
  const typeMap: Record<string, number> = {
    'Original Post': 0,
    Repost: 0,
    'Quote Post': 0,
    'With Media': 0,
  };
  for (const p of posts) {
    if (p.isRepost) typeMap['Repost']++;
    else if (p.isQuotePost) typeMap['Quote Post']++;
    else typeMap['Original Post']++;
    if (p.hasMedia) typeMap['With Media']++;
  }
  const contentTypeBreakdown = Object.entries(typeMap).map(([type, count]) => ({
    type,
    count,
  }));

  return {
    totalProfiles: profiles.length,
    totalPosts: posts.length,
    totalReactions,
    totalComments,
    totalReposts,
    avgEngagementRate: Math.round(avgEngagementRate * 10) / 10,
    mostActiveProfile,
    topPost,
    postsOverTime,
    reactionBreakdown,
    platformBreakdown,
    contentTypeBreakdown,
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface ScrapeOptions {
  maxPostsPerProfile?: number;
  postedLimit?: string;
  scrapeReactions?: boolean;
  scrapeComments?: boolean;
  includeReposts?: boolean;
  includeQuotePosts?: boolean;
}

export function useSocialListener() {
  const [profiles, setProfiles] = useState<TrackedProfile[]>(() =>
    loadJSON<TrackedProfile[]>(PROFILES_KEY, []),
  );
  const [posts, setPosts] = useState<SocialPost[]>(() =>
    loadJSON<SocialPost[]>(POSTS_KEY, []),
  );
  const [runs, setRuns] = useState<ScrapeRun[]>(() =>
    loadJSON<ScrapeRun[]>(RUNS_KEY, []),
  );
  const [isRunning, setIsRunning] = useState(false);
  const [runProgress, setRunProgress] = useState<{
    platform: SocialPlatform;
    status: string;
    items: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { saveJSON(PROFILES_KEY, profiles); }, [profiles]);
  useEffect(() => { saveJSON(POSTS_KEY, posts); }, [posts]);
  useEffect(() => { saveJSON(RUNS_KEY, runs); }, [runs]);

  // ── Profile management ────────────────────────────────────────────────────

  const addProfile = useCallback(
    (url: string, platform: SocialPlatform = 'linkedin') => {
      // Extract handle from URL
      const clean = url.replace(/\/$/, '');
      const parts = clean.split('/');
      const handle = parts[parts.length - 1] || clean;

      const profile: TrackedProfile = {
        id: uuidv4(),
        platform,
        url: clean,
        handle,
        addedAt: new Date().toISOString(),
      };
      setProfiles((prev) => {
        // Deduplicate by URL
        if (prev.some((p) => p.url === clean)) return prev;
        return [...prev, profile];
      });
      return profile;
    },
    [],
  );

  const removeProfile = useCallback((id: string) => {
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    setPosts((prev) => prev.filter((p) => p.profileId !== id));
  }, []);

  const clearAllData = useCallback(() => {
    setPosts([]);
    setRuns([]);
  }, []);

  // ── Scrape ────────────────────────────────────────────────────────────────

  const runScrape = useCallback(
    async (options: ScrapeOptions = {}) => {
      if (profiles.length === 0) {
        setError('Add at least one profile before scraping.');
        return;
      }
      setIsRunning(true);
      setError(null);
      setRunProgress(null);

      const runRecord: ScrapeRun = {
        id: `run_${Date.now()}`,
        profileIds: profiles.map((p) => p.id),
        platform: 'linkedin',
        actorId: 'multi',
        status: 'running',
        startedAt: new Date().toISOString(),
      };
      setRuns((prev) => [runRecord, ...prev.slice(0, 19)]);

      try {
        const newPosts = await scrapeProfiles(
          profiles,
          options,
          (platform, status, items) =>
            setRunProgress({ platform, status, items }),
        );

        // Merge: deduplicate by post ID, keep new data fresh
        setPosts((prev) => {
          const existing = new Map(prev.map((p) => [p.id, p]));
          for (const p of newPosts) existing.set(p.id, p);
          return [...existing.values()].sort(
            (a, b) =>
              new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
          );
        });

        setRuns((prev) =>
          prev.map((r) =>
            r.id === runRecord.id
              ? {
                  ...r,
                  status: 'succeeded',
                  finishedAt: new Date().toISOString(),
                  itemCount: newPosts.length,
                }
              : r,
          ),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setRuns((prev) =>
          prev.map((r) =>
            r.id === runRecord.id ? { ...r, status: 'failed' } : r,
          ),
        );
      } finally {
        setIsRunning(false);
        setRunProgress(null);
      }
    },
    [profiles],
  );

  // ── Derived analytics ─────────────────────────────────────────────────────

  const macroStats = useMemo(
    () => deriveMacroStats(profiles, posts),
    [profiles, posts],
  );

  const profileStatsList = useMemo(
    () => profiles.map((p) => deriveProfileStats(p, posts)),
    [profiles, posts],
  );

  const getPostsForProfile = useCallback(
    (profileId: string) =>
      posts
        .filter((p) => p.profileId === profileId)
        .sort(
          (a, b) =>
            new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
        ),
    [posts],
  );

  const lastRun = runs[0] ?? null;

  return {
    // State
    profiles,
    posts,
    runs,
    isRunning,
    runProgress,
    error,
    lastRun,
    // Actions
    addProfile,
    removeProfile,
    clearAllData,
    runScrape,
    // Analytics
    macroStats,
    profileStatsList,
    getPostsForProfile,
  };
}

import { useState } from 'react';
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { Linkedin, Twitter, Instagram, TrendingUp, MessageSquare, Repeat2, Clock } from 'lucide-react';
import { format, parseISO, subDays, eachDayOfInterval, startOfDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PostCard } from './PostCard';
import type { TrackedProfile, SocialPost, ProfileStats, SocialPlatform } from '@/types/socialListener';

const PLATFORM_ICONS: Record<SocialPlatform, React.ElementType> = {
  linkedin: Linkedin,
  twitter: Twitter,
  instagram: Instagram,
};

const PLATFORM_COLORS: Record<SocialPlatform, string> = {
  linkedin: '#2563EB',
  twitter: '#0EA5E9',
  instagram: '#EC4899',
};

interface MicroViewProps {
  profiles: TrackedProfile[];
  profileStatsList: ProfileStats[];
  getPostsForProfile: (id: string) => SocialPost[];
}

function buildProfileTimeline(posts: SocialPost[]) {
  const days = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() });
  return days.map((day) => {
    const key = format(day, 'MMM d');
    const dayPosts = posts.filter(
      (p) =>
        format(startOfDay(parseISO(p.postedAt)), 'MMM d') === key,
    );
    return {
      date: key,
      posts: dayPosts.length,
      reactions: dayPosts.reduce((s, p) => s + p.totalReactions, 0),
    };
  });
}

function ProfileCard({
  profile,
  stats,
  selected,
  onClick,
}: {
  profile: TrackedProfile;
  stats: ProfileStats;
  selected: boolean;
  onClick: () => void;
}) {
  const Icon = PLATFORM_ICONS[profile.platform];
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer ${
        selected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-300 dark:hover:border-blue-700'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 shrink-0" style={{ color: PLATFORM_COLORS[profile.platform] }} />
        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
          {stats.displayName}
        </span>
        {selected && (
          <Badge className="ml-auto text-[9px] h-4 px-1.5 bg-blue-600">Selected</Badge>
        )}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {[
          { label: 'Posts', value: stats.postCount },
          { label: 'Reactions', value: stats.totalReactions },
          { label: 'Avg Eng.', value: stats.avgEngagement },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">{label}</p>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 tabular-nums">{value}</p>
          </div>
        ))}
      </div>
    </button>
  );
}

export function MicroView({ profiles, profileStatsList, getPostsForProfile }: MicroViewProps) {
  const [selectedId, setSelectedId] = useState<string>(profiles[0]?.id ?? '');

  const selectedProfile = profiles.find((p) => p.id === selectedId);
  const selectedStats = profileStatsList.find((s) => s.profileId === selectedId);
  const selectedPosts = selectedId ? getPostsForProfile(selectedId) : [];
  const timeline = buildProfileTimeline(selectedPosts);

  if (profiles.length === 0) {
    return (
      <Card className="border-slate-200 dark:border-slate-700">
        <CardContent className="py-16 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Add profiles to see per-profile analytics.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Profile selector */}
      <div className="lg:col-span-1 space-y-2">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">
          Profiles
        </p>
        <div className="space-y-2">
          {profiles.map((p) => {
            const stats = profileStatsList.find((s) => s.profileId === p.id)!;
            if (!stats) return null;
            return (
              <ProfileCard
                key={p.id}
                profile={p}
                stats={stats}
                selected={p.id === selectedId}
                onClick={() => setSelectedId(p.id)}
              />
            );
          })}
        </div>
      </div>

      {/* Profile detail */}
      <div className="lg:col-span-2 space-y-4">
        {selectedProfile && selectedStats ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              {(() => {
                const Icon = PLATFORM_ICONS[selectedProfile.platform];
                return <Icon className="w-5 h-5 shrink-0" style={{ color: PLATFORM_COLORS[selectedProfile.platform] }} />;
              })()}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {selectedStats.displayName}
                </p>
                <a
                  href={selectedProfile.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline truncate block"
                >
                  {selectedProfile.url}
                </a>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                {[
                  { icon: TrendingUp, label: 'Posts/wk', value: selectedStats.postsPerWeek },
                  { icon: Clock, label: 'Total Posts', value: selectedStats.postCount },
                  { icon: TrendingUp, label: 'Reactions', value: selectedStats.totalReactions.toLocaleString() },
                  { icon: MessageSquare, label: 'Comments', value: selectedStats.totalComments.toLocaleString() },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label}>
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">{label}</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 tabular-nums">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline chart */}
            <Card className="border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Activity — Last 30 Days
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={timeline}>
                    <defs>
                      <linearGradient id="gradProfile" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor={PLATFORM_COLORS[selectedProfile.platform]}
                          stopOpacity={0.25}
                        />
                        <stop
                          offset="95%"
                          stopColor={PLATFORM_COLORS[selectedProfile.platform]}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" strokeOpacity={0.5} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                      tickLine={false}
                      axisLine={false}
                      interval={6}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                      tickLine={false}
                      axisLine={false}
                      width={25}
                    />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                    <Area
                      type="monotone"
                      dataKey="posts"
                      name="Posts"
                      stroke={PLATFORM_COLORS[selectedProfile.platform]}
                      fill="url(#gradProfile)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Engagement per post bar chart */}
            {selectedPosts.length > 0 && (
              <Card className="border-slate-200 dark:border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Post Engagement (last {Math.min(selectedPosts.length, 15)} posts)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart
                      data={selectedPosts.slice(0, 15).map((p, i) => ({
                        post: `Post ${i + 1}`,
                        reactions: p.totalReactions,
                        comments: p.comments,
                        reposts: p.reposts,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" strokeOpacity={0.4} />
                      <XAxis
                        dataKey="post"
                        tick={{ fontSize: 9, fill: '#94A3B8' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#94A3B8' }}
                        tickLine={false}
                        axisLine={false}
                        width={30}
                      />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                      <Bar dataKey="reactions" name="Reactions" fill="#2563EB" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="comments" name="Comments" fill="#10B981" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="reposts" name="Reposts" fill="#F97316" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Posts feed */}
            <Card className="border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Repeat2 className="w-4 h-4 text-blue-500" />
                  Posts Feed
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {selectedPosts.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedPosts.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    No posts scraped for this profile yet.
                  </p>
                ) : (
                  <ScrollArea className="h-[480px] pr-2">
                    <div className="space-y-2">
                      {selectedPosts.map((post) => (
                        <PostCard key={post.id} post={post} compact />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="flex items-center justify-center h-48 text-sm text-slate-400">
            Select a profile to view details
          </div>
        )}
      </div>
    </div>
  );
}

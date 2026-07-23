import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, MessageSquare, Repeat2, Users, Zap, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PostCard } from './PostCard';
import type { MacroStats } from '@/types/socialListener';

const PLATFORM_COLORS = {
  linkedin: '#2a78d6',
  twitter: '#0EA5E9',
  instagram: '#EC4899',
};

const REACTION_COLORS = ['#2a78d6', '#3B82F6', '#60A5FA', '#93C5FD', '#F97316', '#FB923C'];

const CONTENT_COLORS = ['#2a78d6', '#10B981', '#F59E0B', '#8B5CF6'];

interface KpiCardProps {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent?: string;
}

function KpiCard({ title, value, sub, icon: Icon, accent = 'text-blue-600' }: KpiCardProps) {
  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              {title}
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">
              {value}
            </p>
            {sub && (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>
            )}
          </div>
          <div className={`p-2 rounded-lg bg-slate-50 dark:bg-slate-800 ${accent}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface MacroViewProps {
  stats: MacroStats;
}

export function MacroView({ stats }: MacroViewProps) {
  const reactionData = Object.entries(stats.reactionBreakdown)
    .filter(([, v]) => (v ?? 0) > 0)
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
    .map(([name, value]) => ({ name, value: value ?? 0 }));

  const hasData = stats.totalPosts > 0;

  return (
    <div className="space-y-5">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Total Posts"
          value={stats.totalPosts.toLocaleString()}
          sub={`${stats.totalProfiles} profile${stats.totalProfiles !== 1 ? 's' : ''}`}
          icon={TrendingUp}
          accent="text-blue-600"
        />
        <KpiCard
          title="Total Reactions"
          value={stats.totalReactions.toLocaleString()}
          sub="across all posts"
          icon={Zap}
          accent="text-orange-500"
        />
        <KpiCard
          title="Comments"
          value={stats.totalComments.toLocaleString()}
          sub="total engagement"
          icon={MessageSquare}
          accent="text-emerald-600"
        />
        <KpiCard
          title="Avg Engagement"
          value={stats.avgEngagementRate.toLocaleString()}
          sub="per post"
          icon={Star}
          accent="text-purple-600"
        />
      </div>

      {!hasData ? (
        <Card className="border-slate-200 dark:border-slate-700">
          <CardContent className="py-16 text-center">
            <Repeat2 className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No posts yet. Add profiles and run a scrape to see analytics.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Posts over time */}
          <Card className="border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Posts & Reactions Over Time (30 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={stats.postsOverTime}>
                  <defs>
                    <linearGradient id="gradPosts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2a78d6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#2a78d6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradReactions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F97316" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
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
                    tick={{ fontSize: 10, fill: '#94A3B8' }}
                    tickLine={false}
                    axisLine={false}
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: 11,
                      border: '1px solid #E2E8F0',
                      borderRadius: 6,
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Posts"
                    stroke="#2a78d6"
                    fill="url(#gradPosts)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="reactions"
                    name="Reactions"
                    stroke="#F97316"
                    fill="url(#gradReactions)"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Row: Reaction breakdown + Platform + Content type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Reaction breakdown donut */}
            <Card className="border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Reaction Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reactionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={reactionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={65}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {reactionData.map((_, i) => (
                          <Cell key={i} fill={REACTION_COLORS[i % REACTION_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 6 }}
                        formatter={(v: number) => v.toLocaleString()}
                      />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-40 flex items-center justify-center">
                    <p className="text-xs text-slate-400">
                      Enable "Scrape Reactions" to see breakdown
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Platform breakdown */}
            <Card className="border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Platform Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={stats.platformBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" strokeOpacity={0.4} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="platform"
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickLine={false}
                      axisLine={false}
                      width={70}
                    />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                    <Bar dataKey="posts" name="Posts" radius={[0, 4, 4, 0]}>
                      {stats.platformBreakdown.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={PLATFORM_COLORS[entry.platform] ?? '#2a78d6'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Content type breakdown */}
            <Card className="border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Content Types
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={stats.contentTypeBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" strokeOpacity={0.4} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="type"
                      tick={{ fontSize: 10, fill: '#64748B' }}
                      tickLine={false}
                      axisLine={false}
                      width={80}
                    />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                    <Bar dataKey="count" name="Posts" radius={[0, 4, 4, 0]}>
                      {stats.contentTypeBreakdown.map((_, i) => (
                        <Cell key={i} fill={CONTENT_COLORS[i % CONTENT_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Most active profile */}
          {stats.mostActiveProfile && (
            <Card className="border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  Most Active Profile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { label: 'Handle', value: `@${stats.mostActiveProfile.handle}` },
                    { label: 'Posts', value: stats.mostActiveProfile.postCount },
                    { label: 'Reactions', value: stats.mostActiveProfile.totalReactions.toLocaleString() },
                    { label: 'Avg Engagement', value: stats.mostActiveProfile.avgEngagement },
                    { label: 'Posts/Week', value: stats.mostActiveProfile.postsPerWeek },
                  ].map(({ label, value }) => (
                    <div key={label} className="text-center">
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                        {label}
                      </p>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5 tabular-nums">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top post */}
          {stats.topPost && (
            <Card className="border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Star className="w-4 h-4 text-orange-400" />
                  Top Performing Post
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PostCard post={stats.topPost} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

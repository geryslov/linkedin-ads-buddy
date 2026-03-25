import { useState } from 'react';
import {
  Play, Settings2, Trash2, AlertCircle, CheckCircle2, Loader2,
  BarChart3, User, RefreshCw, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { format, parseISO } from 'date-fns';
import { ProfileManager } from '@/components/social-listener/ProfileManager';
import { MacroView } from '@/components/social-listener/MacroView';
import { MicroView } from '@/components/social-listener/MicroView';
import { useSocialListener, type ScrapeOptions } from '@/hooks/useSocialListener';
import type { SocialPlatform } from '@/types/socialListener';

// ─── Scrape settings sheet ────────────────────────────────────────────────────

function ScrapeSettings({
  options,
  onChange,
}: {
  options: ScrapeOptions;
  onChange: (o: ScrapeOptions) => void;
}) {
  return (
    <div className="space-y-5 py-2">
      <div className="space-y-3">
        <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
          Post limit per profile
        </Label>
        <Select
          value={String(options.maxPostsPerProfile ?? 20)}
          onValueChange={(v) => onChange({ ...options, maxPostsPerProfile: Number(v) })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[10, 20, 50, 100].map((n) => (
              <SelectItem key={n} value={String(n)} className="text-xs">
                {n} posts
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
          Time range
        </Label>
        <Select
          value={options.postedLimit ?? 'month'}
          onValueChange={(v) => onChange({ ...options, postedLimit: v })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[
              { value: '24h', label: 'Last 24 hours' },
              { value: 'week', label: 'Last week' },
              { value: 'month', label: 'Last month' },
              { value: '3months', label: 'Last 3 months' },
              { value: '6months', label: 'Last 6 months' },
              { value: 'year', label: 'Last year' },
              { value: 'any', label: 'All time' },
            ].map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
          Content filters
        </Label>
        {[
          { key: 'includeReposts' as const, label: 'Include reposts', defaultVal: true },
          { key: 'includeQuotePosts' as const, label: 'Include quote posts', defaultVal: true },
        ].map(({ key, label, defaultVal }) => (
          <div key={key} className="flex items-center justify-between">
            <Label className="text-xs text-slate-600 dark:text-slate-400">{label}</Label>
            <Switch
              checked={options[key] ?? defaultVal}
              onCheckedChange={(v) => onChange({ ...options, [key]: v })}
            />
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
          Deep data (increases cost)
        </Label>
        <div className="flex items-center justify-between">
          <Label className="text-xs text-slate-600 dark:text-slate-400">Scrape reactions</Label>
          <Switch
            checked={options.scrapeReactions ?? false}
            onCheckedChange={(v) => onChange({ ...options, scrapeReactions: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs text-slate-600 dark:text-slate-400">Scrape comments</Label>
          <Switch
            checked={options.scrapeComments ?? false}
            onCheckedChange={(v) => onChange({ ...options, scrapeComments: v })}
          />
        </div>
      </div>

      <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed border-t border-slate-100 dark:border-slate-700 pt-3">
        LinkedIn posts: $0.002/post · Reactions: $0.002/reaction · Comments: $0.002/comment
        (via Apify harvestapi actor)
      </p>
    </div>
  );
}

// ─── Run history row ──────────────────────────────────────────────────────────

function RunStatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: React.ElementType }> = {
    succeeded: { cls: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300', icon: CheckCircle2 },
    running: { cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300', icon: Loader2 },
    failed: { cls: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300', icon: AlertCircle },
  };
  const { cls, icon: Icon } = map[status] ?? map['failed'];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>
      <Icon className={`w-3 h-3 ${status === 'running' ? 'animate-spin' : ''}`} />
      {status}
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SocialListener() {
  const {
    profiles,
    posts,
    runs,
    isRunning,
    runProgress,
    error,
    lastRun,
    addProfile,
    removeProfile,
    clearAllData,
    runScrape,
    macroStats,
    profileStatsList,
    getPostsForProfile,
  } = useSocialListener();

  const [scrapeOptions, setScrapeOptions] = useState<ScrapeOptions>({
    maxPostsPerProfile: 20,
    postedLimit: 'month',
    includeReposts: true,
    includeQuotePosts: true,
    scrapeReactions: true,
    scrapeComments: false,
  });

  const [activeTab, setActiveTab] = useState<'macro' | 'micro'>('macro');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans">
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Social Listener
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Powered by Apify · {profiles.length} profile{profiles.length !== 1 ? 's' : ''} tracked
            {posts.length > 0 && ` · ${posts.length} posts`}
          </p>
        </div>

        {/* Run progress indicator */}
        {isRunning && runProgress && (
          <div className="hidden sm:flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="capitalize">{runProgress.platform}</span>
            <span className="text-slate-400">·</span>
            <span>{runProgress.items} items</span>
          </div>
        )}

        {/* Last run info */}
        {!isRunning && lastRun && (
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
            <Clock className="w-3 h-3" />
            Last: {format(parseISO(lastRun.startedAt), 'MMM d, HH:mm')}
            {lastRun.itemCount !== undefined && ` · ${lastRun.itemCount} items`}
          </div>
        )}

        {/* Settings sheet */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled={isRunning}>
              <Settings2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
          </SheetTrigger>
          <SheetContent className="w-80">
            <SheetHeader>
              <SheetTitle className="text-sm">Scrape Settings</SheetTitle>
            </SheetHeader>
            <ScrapeSettings options={scrapeOptions} onChange={setScrapeOptions} />
          </SheetContent>
        </Sheet>

        {/* Run button */}
        <Button
          size="sm"
          onClick={() => runScrape(scrapeOptions)}
          disabled={isRunning || profiles.length === 0}
          className="h-8 gap-1.5 text-xs bg-blue-600 hover:bg-blue-700"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Running…
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              <span>Run Scrape</span>
            </>
          )}
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-red-700 dark:text-red-400">Scrape failed</p>
            <p className="text-xs text-red-600 dark:text-red-400 break-all">{error}</p>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-5 grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Left sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <ProfileManager
            profiles={profiles}
            onAdd={(url, platform) => addProfile(url, platform as SocialPlatform)}
            onRemove={removeProfile}
            isRunning={isRunning}
          />

          {/* Run history */}
          {runs.length > 0 && (
            <Card className="border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  Run History
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {runs.slice(0, 5).map((run) => (
                  <div
                    key={run.id}
                    className="flex items-center justify-between gap-2 text-[11px]"
                  >
                    <RunStatusBadge status={run.status} />
                    <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                      {format(parseISO(run.startedAt), 'MMM d HH:mm')}
                    </span>
                    {run.itemCount !== undefined && (
                      <Badge variant="outline" className="text-[9px] h-4 px-1">
                        {run.itemCount}
                      </Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Clear data */}
          {posts.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border-slate-200 dark:border-slate-700"
                  disabled={isRunning}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Clear all data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all scraped data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete all {posts.length} scraped posts and run history.
                    Your tracked profiles will remain. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700"
                    onClick={clearAllData}
                  >
                    Clear data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {/* Main content */}
        <div className="lg:col-span-3">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'macro' | 'micro')}>
            <div className="flex items-center justify-between mb-4">
              <TabsList className="h-8 gap-1 bg-slate-100 dark:bg-slate-800">
                <TabsTrigger value="macro" className="h-6 px-3 text-xs gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" />
                  Macro
                </TabsTrigger>
                <TabsTrigger value="micro" className="h-6 px-3 text-xs gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  Micro
                </TabsTrigger>
              </TabsList>
              {isRunning && (
                <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 sm:hidden">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {runProgress?.platform} · {runProgress?.items} items
                </div>
              )}
            </div>

            <TabsContent value="macro" className="mt-0">
              <MacroView stats={macroStats} />
            </TabsContent>

            <TabsContent value="micro" className="mt-0">
              <MicroView
                profiles={profiles}
                profileStatsList={profileStatsList}
                getPostsForProfile={getPostsForProfile}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

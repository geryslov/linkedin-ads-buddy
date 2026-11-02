import { useMemo, useState } from 'react';
import { useCompetitorAds, CompetitorAd } from '@/hooks/useCompetitorAds';
import { WidgetCard, EmptyState, StatusPill, SegmentedControl } from '@/components/dashboard/widgets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { exportToCSV } from '@/lib/exportUtils';
import { Binoculars, Search, Loader2, ExternalLink, Download, Info, AlertTriangle } from 'lucide-react';

interface CompetitorAdsProps {
  accessToken: string | null;
}

// LinkedIn's ad type enum → what an advertiser calls it.
const FORMAT_LABELS: Record<string, string> = {
  SPONSORED_STATUS_UPDATE: 'Single image / text',
  SPONSORED_VIDEO: 'Video',
  SPONSORED_UPDATE_CAROUSEL: 'Carousel',
  SPONSORED_UPDATE_NATIVE_DOCUMENT: 'Document',
  SPONSORED_UPDATE_EVENT: 'Event',
  SPONSORED_INMAILS: 'Message Ad',
  SPONSORED_MESSAGE: 'Message Ad',
  TEXT_AD: 'Text ad',
  SPOTLIGHT_V2: 'Spotlight',
  FOLLOW_COMPANY_V2: 'Follower ad',
  JOBS_V2: 'Jobs ad',
};

const formatLabel = (f: string) =>
  FORMAT_LABELS[f] ?? f.toLowerCase().replace(/^sponsored_/, '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

const fmtBand = (b: CompetitorAd['impressions']) =>
  !b ? '—' : b.to === null ? `${fmtNum(b.from)}+` : `${fmtNum(b.from)}–${fmtNum(b.to)}`;

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';

const WINDOWS = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
];

function Breakdown({ title, counts, total, label = (k: string) => k }: {
  title: string;
  counts: Record<string, number>;
  total: number;
  label?: (k: string) => string;
}) {
  const rows = Object.entries(counts).slice(0, 6);
  return (
    <WidgetCard title={title}>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No data</p>
      ) : (
        <ul className="space-y-2">
          {rows.map(([k, n]) => (
            <li key={k} className="text-xs">
              <div className="flex justify-between gap-2 mb-1">
                <span className="truncate text-foreground">{label(k)}</span>
                <span className="tabular-nums text-muted-foreground">{n}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary/70 rounded-full" style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <WidgetCard>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground tabular-nums mt-1">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </WidgetCard>
  );
}

export function CompetitorAds({ accessToken }: CompetitorAdsProps) {
  const { result, isLoading, error, search } = useCompetitorAds(accessToken);
  const [advertiser, setAdvertiser] = useState('');
  const [days, setDays] = useState(30);
  // Advertiser search is fuzzy ("HubSpot" also returns its partners), so exact is the sane default.
  const [exact, setExact] = useState(true);

  const run = () => search({ advertiser, days, exactAdvertiser: exact });

  const ads = useMemo(
    () => [...(result?.ads ?? [])].sort((a, b) => (b.lastImpressionAt ?? '').localeCompare(a.lastImpressionAt ?? '')),
    [result],
  );
  const s = result?.summary;
  const otherMatches = result
    ? Object.entries(result.matchedAdvertisers).filter(([name]) => name.toLowerCase() !== result.advertiser.toLowerCase())
    : [];

  const exportCsv = () =>
    exportToCSV(
      ads.map((a) => ({
        advertiser: a.advertiserName,
        format: formatLabel(a.format),
        firstSeen: a.firstImpressionAt?.split('T')[0] ?? '',
        lastSeen: a.lastImpressionAt?.split('T')[0] ?? '',
        daysRunning: a.daysRunning ?? '',
        impressions: fmtBand(a.impressions),
        locations: a.locations.join('; '),
        languages: a.languages.join('; '),
        targetingUsed: a.targetingFacets.included.join('; '),
        adUrl: a.adUrl,
      })),
      `competitor-ads-${result?.advertiser ?? 'export'}`,
    );

  return (
    <div className="space-y-4">
      <WidgetCard
        title="Look up a competitor"
        subtitle="Public ads from the LinkedIn Ad Library — what they run, where, in which formats, and for how long"
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => { e.preventDefault(); run(); }}
        >
          <div className="space-y-1.5 flex-1 min-w-[220px]">
            <label htmlFor="competitor-advertiser" className="text-xs font-medium text-muted-foreground">Advertiser</label>
            <Input
              id="competitor-advertiser"
              placeholder="e.g. HubSpot"
              value={advertiser}
              onChange={(e) => setAdvertiser(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground block">Served in the last</span>
            <SegmentedControl options={WINDOWS} value={days} onChange={setDays} />
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground h-10">
            <Checkbox checked={exact} onCheckedChange={(v) => setExact(v === true)} />
            Exact name only
          </label>
          <Button type="submit" disabled={!accessToken || !advertiser.trim() || isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </Button>
        </form>
        <p className="text-[11px] text-muted-foreground mt-3 flex items-start gap-1.5">
          <Info className="h-3.5 w-3.5 shrink-0 mt-px" />
          LinkedIn shares formats, run dates, impression ranges, locations and languages — not ad copy, images, or the
          companies and job titles targeted. Searches are rate-limited, so repeat lookups are cached for 10 minutes.
        </p>
      </WidgetCard>

      {error && (
        <WidgetCard>
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        </WidgetCard>
      )}

      {!result && !error && (
        <WidgetCard>
          <EmptyState
            icon={Binoculars}
            title="Search for a competitor"
            description="Enter the advertiser's LinkedIn company name to see the ads they're running."
          />
        </WidgetCard>
      )}

      {result && s && (
        <>
          <div className="flex flex-wrap gap-2">
            {result.rateLimited && <StatusPill tone="warning" label="LinkedIn rate limit hit — partial results, try again in a minute" />}
            {result.truncated && (
              <StatusPill tone="neutral" label={`Newest ${result.fetched} of ${fmtNum(result.totalMatching ?? 0)} matching ads checked`} />
            )}
            {!!result.undated?.count && (
              <StatusPill tone="neutral" label={`${result.undated.count} ads had no delivery data and are not counted`} />
            )}
            {exact && otherMatches.length > 0 && (
              <StatusPill tone="info" label={`${otherMatches.length} similarly named advertisers excluded`} />
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label={`Ads served, last ${result.days} days`} value={String(s.ads)} />
            <Stat label="Active in the last 7 days" value={String(s.activeLast7Days)} />
            <Stat label="Impressions" value={`${fmtNum(s.impressionsAtLeast)}+`} hint="Sum of LinkedIn's range floors" />
            <Stat label="Median days running" value={s.medianDaysRunning === null ? '—' : String(s.medianDaysRunning)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <Breakdown title="Formats" counts={s.byFormat} total={s.ads} label={formatLabel} />
            <Breakdown title="Locations" counts={s.byLocation} total={s.ads} />
            <Breakdown title="Languages" counts={s.byLanguage} total={s.ads} />
            <Breakdown title="Targeting used" counts={s.targetingFacetsUsed} total={s.ads} />
          </div>

          <WidgetCard
            title={`${ads.length} ${ads.length === 1 ? 'ad' : 'ads'}`}
            subtitle="Most recently served first"
            toolbar={
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={ads.length === 0}>
                <Download className="h-4 w-4" />
                CSV
              </Button>
            }
            noPadding
          >
            {ads.length === 0 ? (
              <EmptyState icon={Binoculars} title="No ads in this window" description="Try a longer window, or turn off exact name matching." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-y border-border/70 text-xs text-muted-foreground text-left">
                      <th className="px-5 py-2 font-medium">Format</th>
                      {!exact && <th className="px-3 py-2 font-medium">Advertiser</th>}
                      <th className="px-3 py-2 font-medium">First seen</th>
                      <th className="px-3 py-2 font-medium">Last seen</th>
                      <th className="px-3 py-2 font-medium text-right">Days</th>
                      <th className="px-3 py-2 font-medium text-right">Impressions</th>
                      <th className="px-3 py-2 font-medium">Where</th>
                      <th className="px-5 py-2 font-medium text-right">Ad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ads.map((a) => (
                      <tr key={a.adUrl} className="border-b border-border/40 last:border-0 hover:bg-muted/40">
                        <td className="px-5 py-2 whitespace-nowrap">{formatLabel(a.format)}</td>
                        {!exact && <td className="px-3 py-2 max-w-[180px] truncate">{a.advertiserName}</td>}
                        <td className="px-3 py-2 whitespace-nowrap tabular-nums">{fmtDate(a.firstImpressionAt)}</td>
                        <td className="px-3 py-2 whitespace-nowrap tabular-nums">{fmtDate(a.lastImpressionAt)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{a.daysRunning ?? '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmtBand(a.impressions)}</td>
                        <td className="px-3 py-2 max-w-[220px] truncate" title={[...a.locations, ...a.languages].join(' · ')}>
                          {[...a.locations, ...a.languages].join(' · ') || '—'}
                        </td>
                        <td className="px-5 py-2 text-right">
                          <a
                            href={a.adUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            View <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </WidgetCard>
        </>
      )}
    </div>
  );
}

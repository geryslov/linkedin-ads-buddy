import { useEffect, useState, useMemo } from 'react';
import { useCreativeReporting, CreativeData } from '@/hooks/useCreativeReporting';
import { CreativeTypeBadge } from './CreativeTypeBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { WidgetCard, EmptyState } from './widgets';
import { cn } from '@/lib/utils';
import { Search, ImageIcon, RefreshCw, AlertTriangle, FolderOpen } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

interface CreativeGalleryProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

/** Semantic status dot pinned to the thumbnail corner. */
function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'absolute top-2 right-2 h-2 w-2 rounded-full ring-2 ring-card',
        status === 'ACTIVE'
          ? 'bg-success'
          : status === 'PAUSED'
          ? 'bg-warning'
          : 'bg-muted-foreground/50'
      )}
      title={status}
    />
  );
}

export function CreativeGallery({ accessToken, selectedAccount }: CreativeGalleryProps) {
  const {
    creativeData,
    isLoading,
    error,
    dateRange,
    setDateRange,
    timeFrameOptions,
    setTimeFrame,
    fetchCreativeAnalytics,
  } = useCreativeReporting(accessToken);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCreative, setSelectedCreative] = useState<CreativeData | null>(null);

  useEffect(() => {
    if (selectedAccount) {
      fetchCreativeAnalytics(selectedAccount);
    }
  }, [selectedAccount, fetchCreativeAnalytics]);

  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Filter creatives
  const activeCreatives = useMemo(() => {
    let result = creativeData;

    if (statusFilter !== 'ALL') {
      result = result.filter(c => c.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.creativeName.toLowerCase().includes(q) ||
        c.campaignName.toLowerCase().includes(q)
      );
    }

    return result;
  }, [creativeData, searchQuery, statusFilter]);

  // Get unique statuses for filter
  const availableStatuses = useMemo(() => {
    const statuses = new Set(creativeData.map(c => c.status));
    return Array.from(statuses).sort();
  }, [creativeData]);

  const creativesWithImages = activeCreatives.filter(c => c.imageUrl);
  const creativesWithoutImages = activeCreatives.filter(c => !c.imageUrl);

  if (!selectedAccount) {
    return (
      <WidgetCard noPadding>
        <EmptyState
          icon={FolderOpen}
          title="No account selected"
          description="Select an ad account to view creative images."
        />
      </WidgetCard>
    );
  }

  return (
    <>
      <WidgetCard
        title="Creative Gallery"
        subtitle={
          isLoading
            ? 'Loading creatives…'
            : `${activeCreatives.length} creative${activeCreatives.length !== 1 ? 's' : ''} · ${creativesWithImages.length} with images`
        }
        toolbar={
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search creatives…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-[200px] pl-8 text-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-[130px] text-sm bg-card border-border">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="ALL">All statuses</SelectItem>
                {availableStatuses.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={timeFrameOptions.find(o =>
                o.startDate.toISOString().split('T')[0] === dateRange.start
              )?.value || '30d'}
              onValueChange={(v) => {
                const opt = timeFrameOptions.find(o => o.value === v);
                if (opt) setTimeFrame(opt);
              }}
            >
              <SelectTrigger className="h-8 w-[150px] text-sm bg-card border-border">
                <SelectValue placeholder="Time period" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {timeFrameOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => selectedAccount && fetchCreativeAnalytics(selectedAccount)}
              disabled={isLoading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </>
        }
      >
        {/* Loading skeleton — mirrors card layout */}
        {isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="rounded-xl border border-border/70 overflow-hidden">
                <Skeleton className="aspect-video w-full" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <EmptyState
            icon={AlertTriangle}
            title="Failed to load creatives"
            description={error}
          />
        )}

        {/* Gallery */}
        {!isLoading && !error && (
          <>
            {creativesWithImages.length === 0 && creativesWithoutImages.length === 0 ? (
              <EmptyState
                icon={ImageIcon}
                title="No creatives found"
                description="No active creatives found for the selected time period."
              />
            ) : (
              <div className="space-y-8 animate-fade-in">
                {/* Section: creatives with images */}
                {creativesWithImages.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Ad Creatives <span className="opacity-60">({creativesWithImages.length})</span>
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {creativesWithImages.map((creative, i) => (
                        <div
                          key={`${creative.creativeId}-${i}`}
                          className="group relative rounded-xl border border-border/70 overflow-hidden bg-card card-hover cursor-pointer"
                          style={{ boxShadow: 'var(--shadow-xs)' }}
                          onClick={() => setSelectedCreative(creative)}
                        >
                          {/* Image area — reserved aspect ratio prevents CLS */}
                          <div className="relative aspect-video bg-secondary/60 overflow-hidden">
                            <img
                              src={creative.imageUrl}
                              alt={creative.creativeName}
                              loading="lazy"
                              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                            <StatusDot status={creative.status} />
                            {/* Hover overlay with key metrics */}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 translate-y-full group-hover:translate-y-0 transition-transform duration-200 ease-out">
                              <div className="flex items-center justify-between text-white text-[11px] tabular-nums">
                                <span>{creative.impressions.toLocaleString()} impr.</span>
                                <span>{creative.ctr.toFixed(2)}% CTR</span>
                                <span>${creative.spent.toFixed(0)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="p-3 space-y-1.5">
                            <p className="text-sm font-medium truncate">{creative.creativeName}</p>
                            <p className="text-xs text-muted-foreground truncate">{creative.campaignName}</p>
                            <div className="flex items-center justify-between gap-2">
                              <CreativeTypeBadge type={creative.type} className="min-w-0" />
                              <span className="text-xs text-muted-foreground tabular-nums shrink-0">${creative.spent.toFixed(0)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section: creatives without images — clean secondary grid */}
                {creativesWithoutImages.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      No Preview Available <span className="opacity-60">({creativesWithoutImages.length})</span>
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {creativesWithoutImages.map((creative, i) => (
                        <div
                          key={`no-img-${creative.creativeId}-${i}`}
                          className="rounded-xl border border-border/60 overflow-hidden bg-card/60"
                        >
                          <div className="relative aspect-video bg-secondary/40 border-b border-dashed border-border/60 flex items-center justify-center">
                            <ImageIcon className="h-7 w-7 text-muted-foreground/30" />
                            <StatusDot status={creative.status} />
                          </div>
                          <div className="p-3 space-y-1.5">
                            <p className="text-sm font-medium truncate text-foreground/90">{creative.creativeName}</p>
                            <p className="text-xs text-muted-foreground truncate">{creative.campaignName}</p>
                            <div className="flex items-center justify-between gap-2">
                              <CreativeTypeBadge type={creative.type} className="min-w-0" />
                              <span className="text-xs text-muted-foreground tabular-nums shrink-0">${creative.spent.toFixed(0)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </WidgetCard>

      {/* Detail Dialog */}
      <Dialog open={!!selectedCreative} onOpenChange={(open) => !open && setSelectedCreative(null)}>
        <DialogContent className="max-w-2xl">
          <DialogTitle className="sr-only">{selectedCreative?.creativeName || 'Creative Preview'}</DialogTitle>
          {selectedCreative && (
            <div className="space-y-4">
              {selectedCreative.imageUrl && (
                <img
                  src={selectedCreative.imageUrl}
                  alt={selectedCreative.creativeName}
                  className="w-full h-auto rounded-lg border border-border/60"
                />
              )}
              <div className="space-y-2">
                <h3 className="font-semibold text-lg break-words">{selectedCreative.creativeName}</h3>
                <p className="text-sm text-muted-foreground">{selectedCreative.campaignName}</p>
                <div className="flex gap-2 items-center">
                  <CreativeTypeBadge type={selectedCreative.type} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border/60">
                  {[
                    { label: 'Impressions', value: selectedCreative.impressions.toLocaleString() },
                    { label: 'Clicks', value: selectedCreative.clicks.toLocaleString() },
                    { label: 'Spent', value: `$${selectedCreative.spent.toFixed(2)}` },
                    { label: 'CTR', value: `${selectedCreative.ctr.toFixed(2)}%` },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
                      <p className="font-semibold tabular-nums mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

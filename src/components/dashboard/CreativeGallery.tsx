import { useEffect, useState, useMemo } from 'react';
import { useCreativeReporting, CreativeData } from '@/hooks/useCreativeReporting';
import { CreativeTypeBadge } from './CreativeTypeBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Search, ImageIcon, RefreshCw } from 'lucide-react';
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
      <div className="text-center py-12 text-muted-foreground">
        Select an ad account to view creative images
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search creatives or campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
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
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Time period" />
            </SelectTrigger>
            <SelectContent>
              {timeFrameOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => selectedAccount && fetchCreativeAnalytics(selectedAccount)}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Stats */}
      {!isLoading && (
        <div className="text-sm text-muted-foreground">
          {activeCreatives.length} creative{activeCreatives.length !== 1 ? 's' : ''} · {creativesWithImages.length} with images
        </div>
      )}

      {/* Loading skeleton — mirrors card layout */}
      {isLoading && (
        <div className="space-y-6">
          <Skeleton className="h-4 w-32" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="rounded-lg border border-border/70 overflow-hidden">
                <Skeleton className="aspect-video w-full" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-center py-8 text-destructive">
          {error}
        </div>
      )}

      {/* Gallery */}
      {!isLoading && !error && (
        <>
          {creativesWithImages.length === 0 && creativesWithoutImages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No active creatives found for the selected time period</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Section: creatives with images */}
              {creativesWithImages.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    Ad Creatives ({creativesWithImages.length})
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {creativesWithImages.map((creative, i) => (
                      <div
                        key={`${creative.creativeId}-${i}`}
                        className="group relative rounded-lg border border-border/70 overflow-hidden bg-card hover:border-primary/40 hover:shadow-sm transition-all duration-150 cursor-pointer"
                        onClick={() => setSelectedCreative(creative)}
                      >
                        {/* Image area — reserved aspect ratio prevents CLS */}
                        <div className="relative aspect-video bg-muted overflow-hidden">
                          <img
                            src={creative.imageUrl}
                            alt={creative.creativeName}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                          {/* Status dot badge — top-right */}
                          <span
                            className={cn(
                              'absolute top-2 right-2 h-2 w-2 rounded-full ring-2 ring-background',
                              creative.status === 'ACTIVE'
                                ? 'bg-green-500'
                                : creative.status === 'PAUSED'
                                ? 'bg-yellow-500'
                                : 'bg-gray-400'
                            )}
                            title={creative.status}
                          />
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
                          <div className="flex items-center justify-between">
                            <CreativeTypeBadge type={creative.type} />
                            <span className="text-xs text-muted-foreground">${creative.spent.toFixed(0)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section: creatives without images — compact list */}
              {creativesWithoutImages.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    No Preview Available ({creativesWithoutImages.length})
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {creativesWithoutImages.map((creative, i) => (
                      <div
                        key={`no-img-${creative.creativeId}-${i}`}
                        className="rounded-lg border border-border/70 overflow-hidden bg-card"
                      >
                        <div className="relative aspect-video bg-muted flex items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                          {/* Status dot badge */}
                          <span
                            className={cn(
                              'absolute top-2 right-2 h-2 w-2 rounded-full ring-2 ring-background',
                              creative.status === 'ACTIVE'
                                ? 'bg-green-500'
                                : creative.status === 'PAUSED'
                                ? 'bg-yellow-500'
                                : 'bg-gray-400'
                            )}
                            title={creative.status}
                          />
                        </div>
                        <div className="p-3 space-y-1.5">
                          <p className="text-sm font-medium truncate">{creative.creativeName}</p>
                          <p className="text-xs text-muted-foreground truncate">{creative.campaignName}</p>
                          <div className="flex items-center justify-between">
                            <CreativeTypeBadge type={creative.type} />
                            <span className="text-xs text-muted-foreground">${creative.spent.toFixed(0)}</span>
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
                  className="w-full h-auto rounded-lg"
                />
              )}
              <div className="space-y-2">
                <h3 className="font-semibold text-lg break-words">{selectedCreative.creativeName}</h3>
                <p className="text-sm text-muted-foreground">{selectedCreative.campaignName}</p>
                <div className="flex gap-2 items-center">
                  <CreativeTypeBadge type={selectedCreative.type} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Impressions</p>
                    <p className="font-semibold">{selectedCreative.impressions.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Clicks</p>
                    <p className="font-semibold">{selectedCreative.clicks.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Spent</p>
                    <p className="font-semibold">${selectedCreative.spent.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">CTR</p>
                    <p className="font-semibold">{selectedCreative.ctr.toFixed(2)}%</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

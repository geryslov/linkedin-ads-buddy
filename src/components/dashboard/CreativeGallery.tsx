import { useEffect, useState, useMemo } from 'react';
import { useCreativeReporting, CreativeData } from '@/hooks/useCreativeReporting';
import { CreativeTypeBadge } from './CreativeTypeBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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

  // Filter to only active creatives with images
  const activeCreatives = useMemo(() => {
    let result = creativeData.filter(c => c.status === 'ACTIVE');

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.creativeName.toLowerCase().includes(q) ||
        c.campaignName.toLowerCase().includes(q)
      );
    }

    return result;
  }, [creativeData, searchQuery]);

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
      <div className="text-sm text-muted-foreground">
        {activeCreatives.length} active creative{activeCreatives.length !== 1 ? 's' : ''} · {creativesWithImages.length} with images
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {creativesWithImages.map((creative, i) => (
                <div
                  key={`${creative.creativeId}-${i}`}
                  className="group relative rounded-xl border border-border/50 overflow-hidden bg-card hover:border-primary/30 transition-all cursor-pointer hover:shadow-lg"
                  onClick={() => setSelectedCreative(creative)}
                >
                  <div className="aspect-square overflow-hidden bg-muted/30">
                    <img
                      src={creative.imageUrl}
                      alt={creative.creativeName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
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

              {/* Creatives without images */}
              {creativesWithoutImages.map((creative, i) => (
                <div
                  key={`no-img-${creative.creativeId}-${i}`}
                  className="rounded-xl border border-border/50 overflow-hidden bg-card"
                >
                  <div className="aspect-square overflow-hidden bg-muted/20 flex items-center justify-center">
                    <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
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

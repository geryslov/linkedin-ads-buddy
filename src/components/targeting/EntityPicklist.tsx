import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Search, X, ChevronDown, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { TargetingEntity, TargetingFacet, FACET_INFO } from '@/types/targeting';
import { useTargetingEntities } from '@/hooks/useTargetingEntities';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface EntityPicklistProps {
  facet: TargetingFacet;
  accessToken: string | null;
  selectedEntities: TargetingEntity[];
  onSelect: (entity: TargetingEntity) => void;
  onDeselect: (urn: string) => void;
  multi?: boolean;
  className?: string;
}

export function EntityPicklist({
  facet,
  accessToken,
  selectedEntities,
  onSelect,
  onDeselect,
  multi = true,
  className,
}: EntityPicklistProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [entities, setEntities] = useState<TargetingEntity[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  
  const { fetchEntities, isLoading, error } = useTargetingEntities(accessToken);
  const facetInfo = FACET_INFO[facet];
  const PAGE_SIZE = 25;
  
  // Get min query length for this facet
  const minQueryLength = useMemo(() => {
    if (['SKILLS', 'INDUSTRIES'].includes(facet)) return 2;
    return 0;
  }, [facet]);
  
  const isPreloadable = useMemo(() => {
    return ['SENIORITIES', 'JOB_FUNCTIONS', 'STAFF_COUNT_RANGES'].includes(facet);
  }, [facet]);

  // Load entities
  const loadEntities = useCallback(async (query: string, start: number = 0) => {
    if (!accessToken) return;
    
    // Check min query length for non-preloadable facets
    if (!isPreloadable && query.length < minQueryLength) {
      if (start === 0) {
        setEntities([]);
        setHasMore(false);
      }
      return;
    }
    
    const response = await fetchEntities(facet, query, start, PAGE_SIZE);
    
    if (start === 0) {
      setEntities(response.items);
    } else {
      setEntities(prev => [...prev, ...response.items]);
    }
    
    setHasMore(response.paging.total !== undefined 
      ? start + response.items.length < response.paging.total
      : response.items.length === PAGE_SIZE
    );
    setCurrentPage(Math.floor(start / PAGE_SIZE));
  }, [accessToken, facet, fetchEntities, isPreloadable, minQueryLength]);

  // Debounced search
  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      loadEntities(value, 0);
    }, 200);
  }, [loadEntities]);

  // Load more on scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const nearBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
    
    if (nearBottom && hasMore && !isLoading) {
      loadEntities(searchQuery, (currentPage + 1) * PAGE_SIZE);
    }
  }, [hasMore, isLoading, searchQuery, currentPage, loadEntities]);

  // Initial load when opening
  useEffect(() => {
    if (open && accessToken) {
      loadEntities('', 0);
      // Focus search input
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [open, accessToken, loadEntities]);

  // Clear search when closing
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
    }
  }, [open]);

  const handleSelectEntity = (entity: TargetingEntity) => {
    const isSelected = selectedEntities.some(e => e.urn === entity.urn);
    
    if (isSelected) {
      onDeselect(entity.urn);
    } else {
      onSelect(entity);
      if (!multi) {
        setOpen(false);
      }
    }
  };

  const removeChip = (e: React.MouseEvent, urn: string) => {
    e.stopPropagation();
    onDeselect(urn);
  };

  return (
    <div className={cn('space-y-2', className)}>
      {/* Label */}
      <label className="text-sm font-medium text-foreground">
        {facetInfo.label}
      </label>
      
      {/* Selected chips */}
      {selectedEntities.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedEntities.map(entity => (
            <Badge
              key={entity.urn}
              variant="secondary"
              className="pl-2 pr-1 py-1 gap-1 text-xs font-normal"
            >
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="truncate max-w-[150px]">{entity.name}</span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs font-mono">
                    {entity.urn}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <button
                onClick={(e) => removeChip(e, entity.urn)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      
      {/* Dropdown trigger */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="text-muted-foreground">
              {selectedEntities.length > 0
                ? `${selectedEntities.length} selected`
                : `Select ${facetInfo.plural}...`}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="w-[320px] p-0" align="start">
          {/* Search input */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder={
                  isPreloadable 
                    ? `Search ${facetInfo.plural}...` 
                    : `Type ${minQueryLength}+ chars to search...`
                }
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>
          
          {/* Error state */}
          {error && (
            <div className="p-4 text-center text-sm text-destructive">
              {error}
            </div>
          )}
          
          {/* Results list */}
          <ScrollArea 
            className="h-[280px]"
            onScrollCapture={handleScroll}
          >
            <div ref={scrollRef} className="p-1">
              {/* Initial message for non-preloadable facets */}
              {!isPreloadable && searchQuery.length < minQueryLength && !isLoading && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Start typing to search {facetInfo.plural.toLowerCase()}...
                </div>
              )}
              
              {/* Loading skeleton */}
              {isLoading && entities.length === 0 && (
                <div className="space-y-1 p-1">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-9 w-full" />
                  ))}
                </div>
              )}
              
              {/* Empty state */}
              {!isLoading && entities.length === 0 && (isPreloadable || searchQuery.length >= minQueryLength) && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No matches found
                </div>
              )}
              
              {/* Entity list */}
              {entities.map(entity => {
                const isSelected = selectedEntities.some(e => e.urn === entity.urn);
                return (
                  <div
                    key={entity.urn}
                    className={cn(
                      'flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors',
                      isSelected && 'bg-muted'
                    )}
                    onClick={() => handleSelectEntity(entity)}
                  >
                    <Checkbox
                      checked={isSelected}
                      className="pointer-events-none"
                    />
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex-1 text-sm truncate">{entity.name}</span>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="text-xs font-mono max-w-[300px]">
                          {entity.urn}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                );
              })}
              
              {/* Loading more indicator */}
              {isLoading && entities.length > 0 && (
                <div className="py-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading more...
                </div>
              )}
              
              {/* Load more button (fallback) */}
              {hasMore && !isLoading && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => loadEntities(searchQuery, (currentPage + 1) * PAGE_SIZE)}
                >
                  Load more
                </Button>
              )}
            </div>
          </ScrollArea>
          
          {/* Footer with quick actions */}
          <div className="p-2 border-t flex justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // Select all visible
                entities.forEach(entity => {
                  if (!selectedEntities.some(e => e.urn === entity.urn)) {
                    onSelect(entity);
                  }
                });
              }}
              disabled={entities.length === 0}
            >
              Select All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // Clear all
                selectedEntities.forEach(e => onDeselect(e.urn));
              }}
              disabled={selectedEntities.length === 0}
            >
              Clear All
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

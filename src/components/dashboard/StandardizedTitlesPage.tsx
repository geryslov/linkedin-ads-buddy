import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { WidgetCard, EmptyState, StatusPill } from './widgets';
import { Loader2, Search, Briefcase, Layers } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TitleResult {
  id: string;
  urn: string;
  name: string;
  isSuperTitle: boolean;
  targetable: boolean;
  parentSuperTitle?: {
    urn: string;
    name: string;
  } | null;
  jobFunction?: {
    urn: string;
    name: string;
  } | null;
}

interface StandardizedTitlesPageProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

export function StandardizedTitlesPage({ accessToken, selectedAccount }: StandardizedTitlesPageProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TitleResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const { toast } = useToast();

  const handleSearch = useCallback(async () => {
    if (!accessToken) {
      toast({ title: 'Not authenticated', description: 'Please connect your LinkedIn account first.', variant: 'destructive' });
      return;
    }
    if (query.trim().length < 2) {
      toast({ title: 'Query too short', description: 'Please enter at least 2 characters to search.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]);
    setHasSearched(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_title_details',
          accessToken,
          params: {
            query: query.trim(),
          },
        },
      });

      if (fnError) throw fnError;
      if (data.error) {
        setError(data.error);
        return;
      }

      const processedResults: TitleResult[] = (data.titles || []).map((title: any) => ({
        id: title.id || '',
        urn: title.urn || '',
        name: title.name || '',
        isSuperTitle: title.isSuperTitle || false,
        targetable: title.targetable !== false,
        parentSuperTitle: title.parentSuperTitle || null,
        jobFunction: title.jobFunction || null,
      }));

      setResults(processedResults);

      if (processedResults.length === 0) {
        toast({ title: 'No results', description: `No job titles found matching "${query}"` });
      }
    } catch (err) {
      console.error('[StandardizedTitles] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to search job titles');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, query, selectedAccount, toast]);

  return (
    <div className="space-y-4">
      <WidgetCard
        title="Standardized Titles"
        subtitle="Look up a job title's function category and its parent super title"
        toolbar={
          results.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground tabular-nums">
                {results.length} result{results.length !== 1 ? 's' : ''}
              </span>
              <StatusPill tone="info" label={`${results.filter(t => t.isSuperTitle).length} Super`} />
              <StatusPill tone="neutral" label={`${results.filter(t => !t.isSuperTitle).length} Standard`} />
            </div>
          ) : undefined
        }
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter job title (e.g., Software Engineer, Marketing Manager)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              disabled={isLoading}
              className="flex-1 h-9"
            />
            <Button
              onClick={handleSearch}
              disabled={isLoading || !accessToken || query.trim().length < 2}
              className="h-9"
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Searching...</>
              ) : (
                <><Search className="mr-2 h-4 w-4" />Search</>
              )}
            </Button>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-destructive/[0.06] border border-destructive/20 text-destructive rounded-lg">
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {results.map((title, index) => (
                <div
                  key={title.urn || index}
                  className="px-4 py-3 rounded-lg border border-border/70 bg-card transition-colors hover:border-primary/25"
                  style={{ boxShadow: 'var(--shadow-xs)' }}
                >
                  <div className="flex-1 min-w-0">
                    {/* Title Name + Type */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">{title.name}</span>
                      {title.isSuperTitle ? (
                        <StatusPill tone="info" label="Super Title" />
                      ) : (
                        <StatusPill tone="neutral" label="Standard Title" />
                      )}
                    </div>

                    {/* Function + Super Title info */}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {title.jobFunction?.name && (
                        <span className="inline-flex items-center gap-1.5 bg-success/[0.06] border border-success/15 px-2 py-0.5 rounded text-xs">
                          <Briefcase className="h-3 w-3 text-success" />
                          <span className="text-muted-foreground">Function</span>
                          <span className="font-medium text-foreground">{title.jobFunction.name}</span>
                        </span>
                      )}

                      {!title.isSuperTitle && title.parentSuperTitle?.name && (
                        <span className="inline-flex items-center gap-1.5 bg-primary/[0.06] border border-primary/10 px-2 py-0.5 rounded text-xs">
                          <Layers className="h-3 w-3 text-primary" />
                          <span className="text-muted-foreground">Super Title</span>
                          <span className="font-medium text-foreground">{title.parentSuperTitle.name}</span>
                        </span>
                      )}
                    </div>

                    {/* URN */}
                    <div className="mt-2 text-[11px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded w-fit">
                      {title.urn}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No Results */}
          {hasSearched && !isLoading && !error && results.length === 0 && (
            <EmptyState
              icon={Search}
              title="No matching titles"
              description={`No job titles found matching "${query}". Try a broader term.`}
            />
          )}
        </div>
      </WidgetCard>
    </div>
  );
}

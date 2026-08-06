import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { WidgetCard, EmptyState, StatusPill } from './widgets';
import { Loader2, Search, Crown, Tag, Info, ArrowRight } from 'lucide-react';
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
}

interface TitleCheckerPageProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

export function TitleCheckerPage({ accessToken, selectedAccount }: TitleCheckerPageProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TitleResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const { toast } = useToast();

  const handleSearch = useCallback(async () => {
    if (!accessToken) {
      toast({
        title: 'Not authenticated',
        description: 'Please connect your LinkedIn account first.',
        variant: 'destructive',
      });
      return;
    }

    if (query.trim().length < 2) {
      toast({
        title: 'Query too short',
        description: 'Please enter at least 2 characters to search.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]);
    setHasSearched(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'search_job_titles',
          accessToken,
          params: {
            query: query.trim(),
            accountId: selectedAccount,
          },
        },
      });

      if (fnError) {
        throw fnError;
      }

      if (data.error) {
        setError(data.error);
        setResults([]);
      } else {
        // Use isSuperTitle from API (determined by standardizedTitles lookup)
        const processedResults: TitleResult[] = (data.titles || []).map((title: any) => ({
          id: title.id || '',
          urn: title.urn || '',
          name: title.name || '',
          isSuperTitle: title.isSuperTitle || false,
          targetable: title.targetable !== false,
          parentSuperTitle: title.parentSuperTitle || null,
        }));

        setResults(processedResults);

        if (processedResults.length === 0) {
          toast({
            title: 'No results',
            description: `No job titles found matching "${query}"`,
          });
        }
      }
    } catch (err) {
      console.error('[TitleChecker] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to search job titles');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, query, selectedAccount, toast]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const superTitleCount = results.filter(t => t.isSuperTitle).length;
  const standardTitleCount = results.filter(t => !t.isSuperTitle).length;

  return (
    <div className="space-y-4">
      <WidgetCard
        title="Title Checker"
        subtitle="Check whether a LinkedIn job title is a Super Title or a Standard Title"
        toolbar={
          results.length > 0 ? (
            <div className="flex items-center gap-2">
              <StatusPill tone="info" label={`${superTitleCount} Super`} />
              <StatusPill tone="neutral" label={`${standardTitleCount} Standard`} />
            </div>
          ) : undefined
        }
      >
        <div className="space-y-4">
          {/* Explainer */}
          <div className="rounded-lg bg-secondary/50 border border-border/60 px-4 py-3 flex gap-3">
            <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                <Crown className="h-3 w-3 text-primary inline mr-1" />
                <strong className="text-foreground">Super Titles</strong> are broad job categories
                (e.g. "Engineer", "Manager") — wider audience.
              </p>
              <p>
                <Tag className="h-3 w-3 text-muted-foreground inline mr-1" />
                <strong className="text-foreground">Standard Titles</strong> are specific roles
                (e.g. "Software Engineer", "Marketing Manager") — more precise targeting.
              </p>
            </div>
          </div>

          {/* Search input */}
          <div className="flex gap-2">
            <Input
              placeholder="Enter job title (e.g., Engineer, Marketing Manager, CEO)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              className="flex-1 h-9"
            />
            <Button
              onClick={handleSearch}
              disabled={isLoading || !accessToken || query.trim().length < 2}
              className="h-9"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Check
                </>
              )}
            </Button>
          </div>

          {/* Error Display */}
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
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Title name and type */}
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">{title.name}</span>
                        {title.isSuperTitle ? (
                          <StatusPill tone="info" label="Super Title" />
                        ) : (
                          <StatusPill tone="neutral" label="Standard Title" />
                        )}
                      </div>

                      {/* Description */}
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {title.isSuperTitle
                          ? 'Broad job category — targets a wider audience.'
                          : 'Specific job role — offers more precise targeting.'}
                      </p>

                      {/* Parent Super Title (for standard titles) */}
                      {!title.isSuperTitle && title.parentSuperTitle?.name && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                          <span className="text-muted-foreground">Belongs to</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground/60" />
                          <span className="inline-flex items-center gap-1 bg-primary/[0.06] border border-primary/10 px-1.5 py-0.5 rounded font-medium text-primary">
                            <Crown className="h-3 w-3" />
                            {title.parentSuperTitle.name}
                          </span>
                        </div>
                      )}

                      {/* URN Reference */}
                      <div className="mt-2 text-[11px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded w-fit">
                        {title.urn}
                      </div>
                    </div>

                    {/* Targetable */}
                    {title.targetable && <StatusPill tone="success" label="Targetable" className="shrink-0" />}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No Results State */}
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

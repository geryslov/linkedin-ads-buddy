import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Crown, Tag, Briefcase, Layers, ArrowRight, BookOpen } from 'lucide-react';
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
          action: 'search_job_titles',
          accessToken,
          params: {
            query: query.trim(),
            accountId: selectedAccount,
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-blue-500" />
          Standardized Titles
        </h2>
        <p className="text-muted-foreground">
          Search LinkedIn job titles to see their function and super title
        </p>
      </div>

      {/* Search Card */}
      <Card>
        <CardHeader>
          <CardTitle>Search Job Titles</CardTitle>
          <CardDescription>
            Enter a job title to see its function category and super title
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter job title (e.g., Software Engineer, Marketing Manager)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={handleSearch}
              disabled={isLoading || !accessToken || query.trim().length < 2}
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
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md">
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Summary */}
          {results.length > 0 && (
            <div className="flex gap-4 p-3 bg-muted/50 rounded-lg text-sm">
              <span className="font-medium">{results.length} result{results.length !== 1 ? 's' : ''}</span>
              <span className="text-muted-foreground">|</span>
              <span className="flex items-center gap-1">
                <Crown className="h-3.5 w-3.5 text-purple-500" />
                {results.filter(t => t.isSuperTitle).length} Super
              </span>
              <span className="flex items-center gap-1">
                <Tag className="h-3.5 w-3.5 text-blue-500" />
                {results.filter(t => !t.isSuperTitle).length} Standard
              </span>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {results.map((title, index) => (
                <div
                  key={title.urn || index}
                  className={`p-4 rounded-lg border transition-colors ${
                    title.isSuperTitle
                      ? 'bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800'
                      : 'bg-card border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Title Name + Type Badge */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-semibold text-lg">{title.name}</span>
                        {title.isSuperTitle ? (
                          <Badge className="bg-purple-600 hover:bg-purple-700 text-white">
                            <Crown className="h-3 w-3 mr-1" />
                            Super Title
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                            <Tag className="h-3 w-3 mr-1" />
                            Standard Title
                          </Badge>
                        )}
                      </div>

                      {/* Function + Super Title info */}
                      <div className="mt-3 flex flex-wrap gap-3">
                        {title.jobFunction?.name && (
                          <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800">
                            <Briefcase className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-xs text-muted-foreground">Function:</span>
                            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{title.jobFunction.name}</span>
                          </div>
                        )}

                        {!title.isSuperTitle && title.parentSuperTitle?.name && (
                          <div className="flex items-center gap-1.5 bg-purple-50 dark:bg-purple-950/30 px-2.5 py-1 rounded-md border border-purple-200 dark:border-purple-800">
                            <Layers className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                            <span className="text-xs text-muted-foreground">Super Title:</span>
                            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">{title.parentSuperTitle.name}</span>
                          </div>
                        )}
                      </div>

                      {/* URN */}
                      <div className="mt-2 text-xs text-muted-foreground font-mono bg-muted/50 px-2 py-1 rounded w-fit">
                        {title.urn}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No Results */}
          {hasSearched && !isLoading && !error && results.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No job titles found matching "{query}"</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

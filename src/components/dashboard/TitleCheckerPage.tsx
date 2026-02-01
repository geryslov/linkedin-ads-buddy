import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Crown, Tag, CheckCircle, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TitleResult {
  id: string;
  urn: string;
  name: string;
  isSuperTitle: boolean;
  targetable: boolean;
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
        // Process results and determine super title status from URN
        const processedResults: TitleResult[] = (data.titles || []).map((title: any) => {
          // A title is a super title if its URN contains :superTitle:
          const isSuperTitle = title.urn?.includes(':superTitle:') || false;

          return {
            id: title.id || '',
            urn: title.urn || '',
            name: title.name || '',
            isSuperTitle,
            targetable: title.targetable !== false,
          };
        });

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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Crown className="h-6 w-6 text-purple-500" />
          Title Checker
        </h2>
        <p className="text-muted-foreground">
          Search LinkedIn job titles to check if they are Super Titles or Standard Titles
        </p>
      </div>

      {/* Info Card */}
      <Card className="bg-muted/50 border-muted">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p><strong>What are Super Titles?</strong></p>
              <p className="text-muted-foreground">
                LinkedIn uses a hierarchy for job titles in ad targeting:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                <li>
                  <span className="inline-flex items-center gap-1">
                    <Crown className="h-3 w-3 text-purple-500" />
                    <strong className="text-foreground">Super Titles</strong>
                  </span>
                  {' '}- Broad job categories (e.g., "Engineer", "Manager", "Director"). These target a wider audience.
                </li>
                <li>
                  <span className="inline-flex items-center gap-1">
                    <Tag className="h-3 w-3 text-blue-500" />
                    <strong className="text-foreground">Standard Titles</strong>
                  </span>
                  {' '}- Specific job roles (e.g., "Software Engineer", "Marketing Manager"). These offer more precise targeting.
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Card */}
      <Card>
        <CardHeader>
          <CardTitle>Search Job Titles</CardTitle>
          <CardDescription>
            Enter a job title to check if it's a Super Title or Standard Title
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Input */}
          <div className="flex gap-2">
            <Input
              placeholder="Enter job title (e.g., Engineer, Marketing Manager, CEO)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={handleSearch}
              disabled={isLoading || !accessToken || query.trim().length < 2}
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
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md">
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Summary Stats */}
          {results.length > 0 && (
            <div className="flex gap-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium">{superTitleCount} Super Title{superTitleCount !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">{standardTitleCount} Standard Title{standardTitleCount !== 1 ? 's' : ''}</span>
              </div>
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
                      : 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Title Name and Type Badge */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-semibold text-lg">{title.name}</span>
                        {title.isSuperTitle ? (
                          <Badge className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white">
                            <Crown className="h-3 w-3" />
                            Super Title
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="flex items-center gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                            <Tag className="h-3 w-3" />
                            Standard Title
                          </Badge>
                        )}
                      </div>

                      {/* Description */}
                      <p className="mt-2 text-sm text-muted-foreground">
                        {title.isSuperTitle
                          ? 'This is a Super Title - it represents a broad job category and will target a wider audience.'
                          : 'This is a Standard Title - it represents a specific job role and offers more precise targeting.'}
                      </p>

                      {/* URN Reference */}
                      <div className="mt-2 text-xs text-muted-foreground font-mono bg-muted/50 px-2 py-1 rounded w-fit">
                        {title.urn}
                      </div>
                    </div>

                    {/* Targetable Badge */}
                    {title.targetable && (
                      <Badge variant="outline" className="flex items-center gap-1 text-green-600 border-green-300 shrink-0">
                        <CheckCircle className="h-3 w-3" />
                        Targetable
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No Results State */}
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

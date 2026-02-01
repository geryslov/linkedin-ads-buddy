import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Crown, Tag, ArrowRight, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface JobTitle {
  id: string;
  urn: string;
  name: string;
  targetable: boolean;
  facetUrn?: string;
  isSuperTitle?: boolean;
  parentSuperTitle?: {
    urn: string;
    name: string;
  } | null;
}

interface SuperTitleCheckerProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

export function SuperTitleChecker({ accessToken, selectedAccount }: SuperTitleCheckerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<JobTitle[]>([]);
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
        setResults(data.titles || []);

        if (data.titles?.length === 0) {
          toast({
            title: 'No results',
            description: `No job titles found matching "${query}"`,
          });
        }
      }
    } catch (err) {
      console.error('[SuperTitleChecker] Error:', err);
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-purple-500" />
          Super Title Checker
        </CardTitle>
        <CardDescription>
          Search for job titles to check if they are Super Titles (broad category) or Standard Titles (specific roles)
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
                Checking...
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
            <XCircle className="h-4 w-4 flex-shrink-0" />
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
          <div className="space-y-2">
            <div className="max-h-[500px] overflow-y-auto space-y-2">
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
                      {/* Title Name and Status */}
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

                      {/* Super Title Indicator */}
                      <div className="mt-2 flex items-center gap-2">
                        {title.isSuperTitle ? (
                          <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              This IS a Super Title - it represents a broad job category
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                            <XCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              This is NOT a Super Title - it's a specific job role
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Parent Super Title Info */}
                      {!title.isSuperTitle && title.parentSuperTitle?.name && (
                        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground bg-white/50 dark:bg-black/20 rounded px-2 py-1 w-fit">
                          <span>Belongs to:</span>
                          <ArrowRight className="h-3 w-3" />
                          <Crown className="h-3 w-3 text-purple-500" />
                          <span className="font-medium text-foreground">{title.parentSuperTitle.name}</span>
                          <Badge variant="outline" className="text-xs ml-1">Super Title</Badge>
                        </div>
                      )}

                      {/* URN Reference */}
                      <div className="mt-2 text-xs text-muted-foreground font-mono">
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
          </div>
        )}

        {/* No Results */}
        {hasSearched && !isLoading && !error && results.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No job titles found matching "{query}"</p>
          </div>
        )}

        {/* Initial State / Help */}
        {!hasSearched && (
          <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg space-y-3">
            <p><strong>What are Super Titles?</strong></p>
            <p>
              LinkedIn uses a hierarchy for job titles in ad targeting:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <span className="inline-flex items-center gap-1">
                  <Crown className="h-3 w-3 text-purple-500" />
                  <strong>Super Titles</strong>
                </span>
                {' '}- Broad job categories (e.g., "Engineer", "Manager", "Director")
              </li>
              <li>
                <span className="inline-flex items-center gap-1">
                  <Tag className="h-3 w-3 text-blue-500" />
                  <strong>Standard Titles</strong>
                </span>
                {' '}- Specific job roles (e.g., "Software Engineer", "Marketing Manager")
              </li>
            </ul>
            <p className="mt-2 text-xs">
              Super Titles allow broader targeting while Standard Titles offer more precise audience selection.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

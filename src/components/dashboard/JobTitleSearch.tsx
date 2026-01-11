import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface JobTitle {
  id: string;
  urn: string;
  name: string;
  targetable: boolean;
  facetUrn?: string;
}

interface JobTitleSearchProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

export function JobTitleSearch({ accessToken, selectedAccount }: JobTitleSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<JobTitle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
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

    try {
      const { data, error: fnError } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'search_job_titles',
          accessToken,
          query: query.trim(),
          accountId: selectedAccount,
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
        setSource(data.source || null);
        
        if (data.titles?.length === 0) {
          toast({
            title: 'No results',
            description: `No targetable job titles found matching "${query}"`,
          });
        }
      }
    } catch (err) {
      console.error('[JobTitleSearch] Error:', err);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          Job Title Targeting Search
        </CardTitle>
        <CardDescription>
          Search for job titles and check if they're available for LinkedIn Ads targeting
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Enter job title to search (e.g., Software Engineer, Marketing Manager)"
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
                Search
              </>
            )}
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Found {results.length} targetable job title{results.length !== 1 ? 's' : ''}
              </span>
              {source && (
                <Badge variant="outline" className="text-xs">
                  Source: {source}
                </Badge>
              )}
            </div>
            
            <div className="max-h-[400px] overflow-y-auto border rounded-lg divide-y">
              {results.map((title, index) => (
                <div 
                  key={title.urn || index} 
                  className="p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{title.name}</span>
                        {title.targetable && (
                          <Badge variant="default" className="flex items-center gap-1 bg-green-600 hover:bg-green-700">
                            <CheckCircle2 className="h-3 w-3" />
                            Targetable
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 font-mono truncate">
                        {title.urn || `ID: ${title.id}`}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && results.length === 0 && query.length >= 2 && (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Enter a job title and click Search to find targetable options</p>
          </div>
        )}

        {/* Initial State */}
        {!isLoading && !error && results.length === 0 && query.length < 2 && (
          <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg space-y-2">
            <p><strong>How it works:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>Enter a job title you want to target in LinkedIn Ads</li>
              <li>The search queries LinkedIn's Ad Targeting API</li>
              <li>Results show official job titles available for targeting</li>
              <li>Use these exact titles in your campaign targeting for best results</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

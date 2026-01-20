import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Skill {
  id: string;
  urn: string;
  name: string;
  targetable: boolean;
  facetUrn?: string;
}

interface SkillSearchProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

export function SkillSearch({ accessToken, selectedAccount }: SkillSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Skill[]>([]);
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
          action: 'search_skills',
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
        setResults(data.skills || []);
        setSource(data.source || null);
        
        if (data.skills?.length === 0) {
          toast({
            title: 'No results',
            description: `No targetable skills found matching "${query}"`,
          });
        }
      }
    } catch (err) {
      console.error('[SkillSearch] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to search skills');
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
          <Sparkles className="h-5 w-5 text-primary" />
          Skills Targeting Search
        </CardTitle>
        <CardDescription>
          Search for skills and check if they're available for LinkedIn Ads targeting
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Enter skill to search (e.g., React, Project Management, Data Analysis)"
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
                Found {results.length} targetable skill{results.length !== 1 ? 's' : ''}
              </span>
              {source && (
                <Badge variant="outline" className="text-xs">
                  Source: {source}
                </Badge>
              )}
            </div>
            
            <div className="max-h-[400px] overflow-y-auto border rounded-lg divide-y">
              {results.map((skill, index) => (
                <div 
                  key={skill.urn || index} 
                  className="p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{skill.name}</span>
                        {skill.targetable && (
                          <Badge variant="default" className="flex items-center gap-1 bg-primary hover:bg-primary/90">
                            <CheckCircle2 className="h-3 w-3" />
                            Targetable
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 font-mono truncate">
                        {skill.urn || `ID: ${skill.id}`}
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
            <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Enter a skill and click Search to find targetable options</p>
          </div>
        )}

        {/* Initial State */}
        {!isLoading && !error && results.length === 0 && query.length < 2 && (
          <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg space-y-2">
            <p><strong>How it works:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>Enter a skill you want to target in LinkedIn Ads</li>
              <li>The search queries LinkedIn's Ad Targeting API</li>
              <li>Results show official skills available for targeting</li>
              <li>Use these exact skills in your campaign targeting for best results</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

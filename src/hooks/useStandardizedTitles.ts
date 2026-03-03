import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ResolvedFunction {
  urn: string;
  name: string | null;
}

export interface ResolvedSuperTitle {
  urn: string;
  name: string | null;
}

export interface StandardizedTitle {
  id: number;
  urn: string;
  name: string;
  function: ResolvedFunction;
  superTitle: ResolvedSuperTitle;
}

export interface StandardizedTitlesMetadata {
  total: number;
  locale: string;
  superTitlesResolved: number;
}

export function useStandardizedTitles(accessToken: string | null) {
  const [titles, setTitles] = useState<StandardizedTitle[]>([]);
  const [metadata, setMetadata] = useState<StandardizedTitlesMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchAllTitles = useCallback(async (locale?: string) => {
    if (!accessToken) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_standardized_titles',
          accessToken,
          params: { locale },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setTitles(data.titles || []);
      setMetadata(data.metadata || null);
    } catch (error: any) {
      console.error('[useStandardizedTitles] fetchAllTitles error:', error);
      toast({ title: 'Error fetching titles', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  const fetchTitlesByIds = useCallback(async (titleIds: number[], locale?: string) => {
    if (!accessToken || titleIds.length === 0) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_standardized_titles',
          accessToken,
          params: { titleIds, locale },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setTitles(data.titles || []);
      setMetadata(data.metadata || null);
    } catch (error: any) {
      console.error('[useStandardizedTitles] fetchTitlesByIds error:', error);
      toast({ title: 'Error fetching titles', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  return {
    titles,
    metadata,
    isLoading,
    fetchAllTitles,
    fetchTitlesByIds,
  };
}

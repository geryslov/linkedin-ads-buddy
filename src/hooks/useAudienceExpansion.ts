import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TitlePerformance {
  titleUrn: string;
  titleId: string;
  titleName: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  ctr: number;
  cpl: number;
}

export interface FunctionPerformance {
  functionUrn: string;
  functionName: string;
  leads: number;
  cpl: number;
}

export interface SuggestedTitle {
  titleId: string;
  titleName: string;
  reason: string;
}

export interface ExpansionSuggestion {
  basedOn: {
    titleId: string;
    titleName: string;
    cpl: number;
    leads: number;
  };
  suggestedTitles: SuggestedTitle[];
}

export interface FunctionSuggestion {
  functionName: string;
  currentPerformance: {
    leads: number;
    cpl: number;
  };
  suggestion: string;
}

export interface AudienceExpansionData {
  period: {
    start: string;
    end: string;
  };
  topPerformers: {
    titles: TitlePerformance[];
    functions: FunctionPerformance[];
  };
  suggestions: ExpansionSuggestion[];
  functionSuggestions: FunctionSuggestion[];
  summary: {
    totalTitlesAnalyzed: number;
    titlesWithLeads: number;
    expansionSuggestions: number;
  };
}

export function useAudienceExpansion(accessToken: string | null) {
  const [data, setData] = useState<AudienceExpansionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const formatDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { start: formatDate(start), end: formatDate(now) };
  });
  const [selectedTitles, setSelectedTitles] = useState<Set<string>>(new Set());

  const fetchAudienceExpansion = useCallback(async (accountId: string, topN: number = 10) => {
    if (!accessToken || !accountId) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_audience_expansion',
          accessToken,
          params: { accountId, dateRange, topN }
        }
      });

      if (fnError) {
        setError(fnError.message || 'Failed to fetch audience expansion data');
        return;
      }

      if (result?.error) {
        setError(result.error);
        return;
      }

      setData(result);
    } catch (err) {
      setError('Failed to fetch audience expansion data');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, dateRange]);

  const toggleTitleSelection = useCallback((titleId: string) => {
    setSelectedTitles(prev => {
      const next = new Set(prev);
      if (next.has(titleId)) {
        next.delete(titleId);
      } else {
        next.add(titleId);
      }
      return next;
    });
  }, []);

  const selectAllSuggestions = useCallback(() => {
    if (!data) return;
    const allTitleIds = data.suggestions.flatMap(s => s.suggestedTitles.map(t => t.titleId));
    setSelectedTitles(new Set(allTitleIds));
  }, [data]);

  const clearSelection = useCallback(() => {
    setSelectedTitles(new Set());
  }, []);

  const allSuggestedTitles = useMemo(() => {
    if (!data) return [];
    return data.suggestions.flatMap(s =>
      s.suggestedTitles.map(t => ({
        ...t,
        basedOnTitle: s.basedOn.titleName,
        basedOnCpl: s.basedOn.cpl,
      }))
    );
  }, [data]);

  return {
    data,
    isLoading,
    error,
    fetchAudienceExpansion,
    dateRange,
    setDateRange,
    selectedTitles,
    toggleTitleSelection,
    selectAllSuggestions,
    clearSelection,
    allSuggestedTitles,
  };
}

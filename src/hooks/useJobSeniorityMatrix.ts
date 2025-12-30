import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface MatrixCell {
  jobFunction: string;
  seniority: string;
  impressions: number;
  clicks: number;
  spent: number;
  leads: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpl: number;
}

export interface MatrixData {
  rows: string[];           // Job Function labels
  columns: string[];        // Seniority labels
  cells: Map<string, MatrixCell>;  // key: "jobFunction|seniority"
  minValue: number;
  maxValue: number;
}

export type MetricType = 'impressions' | 'clicks' | 'spent' | 'leads' | 'ctr' | 'cpc' | 'cpm' | 'cpl';

export interface TimeFrameOption {
  label: string;
  value: string;
  startDate: Date;
  endDate: Date;
}

// Standard seniority order for columns
const SENIORITY_ORDER = ['Entry', 'Senior', 'Manager', 'Director', 'VP', 'CXO', 'Partner', 'Owner', 'Training', 'Unpaid'];

export function useJobSeniorityMatrix(accessToken: string | null) {
  const [matrixData, setMatrixData] = useState<MatrixData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('impressions');
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const { toast } = useToast();

  const timeFrameOptions: TimeFrameOption[] = useMemo(() => {
    const today = new Date();
    return [
      {
        label: 'Last 7 days',
        value: '7d',
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: today,
      },
      {
        label: 'Last 14 days',
        value: '14d',
        startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        endDate: today,
      },
      {
        label: 'Last 30 days',
        value: '30d',
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: today,
      },
      {
        label: 'Last 90 days',
        value: '90d',
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        endDate: today,
      },
      {
        label: 'This month',
        value: 'this_month',
        startDate: new Date(today.getFullYear(), today.getMonth(), 1),
        endDate: today,
      },
      {
        label: 'Last month',
        value: 'last_month',
        startDate: new Date(today.getFullYear(), today.getMonth() - 1, 1),
        endDate: new Date(today.getFullYear(), today.getMonth(), 0),
      },
    ];
  }, []);

  const fetchMatrix = useCallback(async (accountId: string) => {
    if (!accessToken || !accountId) return;
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Fetching job x seniority matrix with params:', { accountId, dateRange, selectedCampaignIds });
      
      const { data, error: fetchError } = await supabase.functions.invoke('linkedin-api', {
        body: { 
          action: 'get_job_seniority_matrix', 
          accessToken,
          params: { 
            accountId, 
            dateRange,
            campaignIds: selectedCampaignIds.length > 0 ? selectedCampaignIds : undefined,
          }
        }
      });

      if (fetchError) throw fetchError;
      
      if (data.error) {
        setError(data.error);
        setMatrixData(null);
        return;
      }
      
      console.log('Job x Seniority matrix response:', data);
      
      // Process the matrix data
      const cells = new Map<string, MatrixCell>();
      const rowsSet = new Set<string>();
      const columnsSet = new Set<string>();
      
      for (const el of (data.elements || [])) {
        const key = `${el.jobFunction}|${el.seniority}`;
        rowsSet.add(el.jobFunction);
        columnsSet.add(el.seniority);
        cells.set(key, {
          jobFunction: el.jobFunction,
          seniority: el.seniority,
          impressions: el.impressions || 0,
          clicks: el.clicks || 0,
          spent: parseFloat(el.spent || '0'),
          leads: el.leads || 0,
          ctr: parseFloat(el.ctr || '0'),
          cpc: parseFloat(el.cpc || '0'),
          cpm: parseFloat(el.cpm || '0'),
          cpl: parseFloat(el.cpl || '0'),
        });
      }

      // Sort rows alphabetically
      const rows = Array.from(rowsSet).sort();
      
      // Sort columns by predefined seniority order
      const columns = Array.from(columnsSet).sort((a, b) => {
        const aIndex = SENIORITY_ORDER.indexOf(a);
        const bIndex = SENIORITY_ORDER.indexOf(b);
        if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });

      // Calculate min/max for selected metric
      let minValue = Infinity;
      let maxValue = -Infinity;
      cells.forEach(cell => {
        const value = cell[selectedMetric];
        if (value > 0) {
          minValue = Math.min(minValue, value);
          maxValue = Math.max(maxValue, value);
        }
      });
      
      if (minValue === Infinity) minValue = 0;
      if (maxValue === -Infinity) maxValue = 0;

      setMatrixData({ rows, columns, cells, minValue, maxValue });
    } catch (err: any) {
      console.error('Fetch job x seniority matrix error:', err);
      setError(err.message || 'Failed to fetch matrix data');
      toast({
        title: 'Error',
        description: err.message || 'Failed to fetch matrix data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, dateRange, selectedCampaignIds, selectedMetric, toast]);

  // Calculate totals
  const totals = useMemo(() => {
    if (!matrixData) return { impressions: 0, clicks: 0, spent: 0, leads: 0 };
    
    let totals = { impressions: 0, clicks: 0, spent: 0, leads: 0 };
    matrixData.cells.forEach(cell => {
      totals.impressions += cell.impressions;
      totals.clicks += cell.clicks;
      totals.spent += cell.spent;
      totals.leads += cell.leads;
    });
    return totals;
  }, [matrixData]);

  // Recalculate min/max when metric changes
  const recalculatedMinMax = useMemo(() => {
    if (!matrixData) return { minValue: 0, maxValue: 0 };
    
    let minValue = Infinity;
    let maxValue = -Infinity;
    matrixData.cells.forEach(cell => {
      const value = cell[selectedMetric];
      if (value > 0) {
        minValue = Math.min(minValue, value);
        maxValue = Math.max(maxValue, value);
      }
    });
    
    if (minValue === Infinity) minValue = 0;
    if (maxValue === -Infinity) maxValue = 0;
    
    return { minValue, maxValue };
  }, [matrixData, selectedMetric]);

  const setTimeFrame = useCallback((option: TimeFrameOption) => {
    setDateRange({
      start: option.startDate.toISOString().split('T')[0],
      end: option.endDate.toISOString().split('T')[0],
    });
  }, []);

  return {
    matrixData: matrixData ? { ...matrixData, ...recalculatedMinMax } : null,
    isLoading,
    error,
    totals,
    selectedMetric,
    setSelectedMetric,
    selectedCampaignIds,
    setSelectedCampaignIds,
    dateRange,
    setDateRange,
    timeFrameOptions,
    setTimeFrame,
    fetchMatrix,
  };
}

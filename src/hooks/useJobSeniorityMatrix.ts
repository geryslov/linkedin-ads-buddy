import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface MatrixCell {
  jobFunction: string;
  jobFunctionUrn: string;
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
  urnMap: Map<string, string>;     // Map from jobFunction label to URN
  minValue: number;
  maxValue: number;
}

export interface TitleData {
  title: string;
  impressions: number;
  clicks: number;
  spent: number;
  leads: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpl: number;
}

export interface TitleMapping {
  job_function_id: string;
  job_function_label: string;
  confidence: number;
  method: 'rules' | 'user_override' | 'ai';
}

export interface TitleWithMapping extends TitleData {
  mapping?: TitleMapping;
}

export interface TitleDrilldownData {
  jobFunction: string;
  jobFunctionUrn: string;
  jobFunctionId: string;
  titles: TitleWithMapping[];
  allTitlesCount: number;
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

// Job function ID to label mapping
const JOB_FUNCTION_MAP: Record<string, string> = {
  '1': 'Accounting', '2': 'Administrative', '3': 'Arts and Design',
  '4': 'Business Development', '5': 'Community & Social Services', '6': 'Consulting',
  '7': 'Education', '8': 'Engineering', '9': 'Entrepreneurship',
  '10': 'Finance', '11': 'Healthcare Services', '12': 'Human Resources',
  '13': 'Information Technology', '14': 'Legal', '15': 'Marketing',
  '16': 'Media & Communications', '17': 'Military & Protective Services', '18': 'Operations',
  '19': 'Product Management', '20': 'Program & Project Management', '21': 'Purchasing',
  '22': 'Quality Assurance', '23': 'Real Estate', '24': 'Research',
  '25': 'Sales', '26': 'Support',
};

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
  
  // Drill-down state
  const [expandedFunction, setExpandedFunction] = useState<string | null>(null);
  const [titleData, setTitleData] = useState<TitleDrilldownData | null>(null);
  const [isTitleLoading, setIsTitleLoading] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  
  // Cache for titles index and mappings
  const [titlesIndex, setTitlesIndex] = useState<TitleData[]>([]);
  const [titleMappings, setTitleMappings] = useState<Record<string, TitleMapping>>({});
  const [titlesIndexDateRange, setTitlesIndexDateRange] = useState<string>('');
  
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
      const urnMap = new Map<string, string>();
      
      for (const el of (data.elements || [])) {
        const key = `${el.jobFunction}|${el.seniority}`;
        rowsSet.add(el.jobFunction);
        columnsSet.add(el.seniority);
        
        // Store URN mapping for drill-down
        if (el.jobFunctionUrn) {
          urnMap.set(el.jobFunction, el.jobFunctionUrn);
        }
        
        cells.set(key, {
          jobFunction: el.jobFunction,
          jobFunctionUrn: el.jobFunctionUrn || '',
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

      setMatrixData({ rows, columns, cells, urnMap, minValue, maxValue });
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

  // Extract function ID from URN
  const extractFunctionId = (urn: string): string => {
    if (!urn) return '0';
    const parts = urn.split(':');
    return parts[parts.length - 1] || '0';
  };

  // Fetch title drill-down data using new stable approach
  const fetchTitleDrilldown = useCallback(async (accountId: string, jobFunctionUrn: string, jobFunctionLabel: string) => {
    if (!accessToken || !accountId) return;
    
    const jobFunctionId = extractFunctionId(jobFunctionUrn);
    
    setExpandedFunction(jobFunctionLabel);
    setTitleData(null);
    setTitleError(null);
    setIsTitleLoading(true);
    
    try {
      console.log('Fetching title drill-down for:', jobFunctionLabel, jobFunctionId);
      
      // Check if we need to refresh titles index (date range changed)
      const currentDateRangeKey = `${dateRange.start}-${dateRange.end}-${selectedCampaignIds.join(',')}`;
      let titles = titlesIndex;
      
      if (titlesIndexDateRange !== currentDateRangeKey || titles.length === 0) {
        console.log('Fetching fresh titles index...');
        
        const { data: indexData, error: indexError } = await supabase.functions.invoke('linkedin-api', {
          body: { 
            action: 'get_job_titles_index', 
            accessToken,
            params: { 
              accountId, 
              dateRange,
              campaignIds: selectedCampaignIds.length > 0 ? selectedCampaignIds : undefined,
            }
          }
        });

        if (indexError) throw indexError;
        if (indexData.error) throw new Error(indexData.error);
        
        titles = indexData.titles || [];
        setTitlesIndex(titles);
        setTitlesIndexDateRange(currentDateRangeKey);
        console.log('Titles index loaded:', titles.length, 'titles');
      }
      
      // Resolve mappings for any new titles
      const titlesToResolve = titles
        .map(t => t.title)
        .filter(t => !titleMappings[t]);
      
      if (titlesToResolve.length > 0) {
        console.log('Resolving mappings for', titlesToResolve.length, 'new titles...');
        
        const { data: mappingsData, error: mappingsError } = await supabase.functions.invoke('linkedin-api', {
          body: { 
            action: 'resolve_titles_to_functions', 
            accessToken,
            params: { titles: titlesToResolve }
          }
        });

        if (mappingsError) throw mappingsError;
        
        const newMappings = mappingsData.mappings || {};
        setTitleMappings(prev => ({ ...prev, ...newMappings }));
        console.log('Mappings resolved:', Object.keys(newMappings).length);
        
        // Merge with existing mappings for filtering
        Object.assign(titleMappings, newMappings);
      }
      
      // Filter titles to selected function
      const filteredTitles: TitleWithMapping[] = titles
        .filter(t => {
          const mapping = titleMappings[t.title];
          return mapping && mapping.job_function_id === jobFunctionId;
        })
        .map(t => ({
          ...t,
          mapping: titleMappings[t.title],
        }));
      
      console.log('Filtered titles for function', jobFunctionLabel, ':', filteredTitles.length);
      
      setTitleData({
        jobFunction: jobFunctionLabel,
        jobFunctionUrn,
        jobFunctionId,
        titles: filteredTitles,
        allTitlesCount: titles.length,
      });
    } catch (err: any) {
      console.error('Fetch title drill-down error:', err);
      setTitleError(err.message || 'Failed to fetch title data');
      toast({
        title: 'Error',
        description: err.message || 'Failed to fetch title data',
        variant: 'destructive',
      });
    } finally {
      setIsTitleLoading(false);
    }
  }, [accessToken, dateRange, selectedCampaignIds, titlesIndex, titleMappings, titlesIndexDateRange, toast]);

  // Override a title mapping
  const overrideTitleMapping = useCallback(async (
    title: string,
    newFunctionId: string,
    newFunctionLabel: string,
    reason?: string
  ) => {
    try {
      const normalizedTitle = title.toLowerCase().trim().replace(/\s+/g, ' ');
      
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: { 
          action: 'override_title_mapping', 
          accessToken,
          params: { 
            normalizedTitle,
            originalTitle: title,
            newFunctionId,
            newFunctionLabel,
            reason,
          }
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      // Update local mappings cache
      setTitleMappings(prev => ({
        ...prev,
        [title]: {
          job_function_id: newFunctionId,
          job_function_label: newFunctionLabel,
          confidence: 1.0,
          method: 'user_override',
        },
      }));
      
      toast({
        title: 'Classification updated',
        description: `"${title}" is now classified as ${newFunctionLabel}`,
      });
      
      return true;
    } catch (err: any) {
      console.error('Override mapping error:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to update classification',
        variant: 'destructive',
      });
      return false;
    }
  }, [accessToken, toast]);

  const closeTitleDrilldown = useCallback(() => {
    setExpandedFunction(null);
    setTitleData(null);
    setTitleError(null);
  }, []);

  // Expose job function map for UI
  const jobFunctionOptions = useMemo(() => 
    Object.entries(JOB_FUNCTION_MAP).map(([id, label]) => ({ id, label })),
  []);

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
    // Drill-down exports
    expandedFunction,
    titleData,
    isTitleLoading,
    titleError,
    fetchTitleDrilldown,
    closeTitleDrilldown,
    overrideTitleMapping,
    jobFunctionOptions,
  };
}
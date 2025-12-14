import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type LookbackWindow = 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'LAST_60_DAYS' | 'LAST_90_DAYS';

export interface CompanyIntelligence {
  companyName: string;
  companyPageUrl: string;
  companyWebsite: string;
  engagementLevel: string;
  paidImpressions: number;
  paidClicks: number;
  paidLeads: number;
  paidEngagements: number;
  organicImpressions: number;
  organicEngagements: number;
  paidCtr: string;
}

export interface UseCompanyIntelligenceReturn {
  companyData: CompanyIntelligence[];
  isLoading: boolean;
  error: string | null;
  lookbackWindow: LookbackWindow;
  setLookbackWindow: (window: LookbackWindow) => void;
  fetchCompanyIntelligence: (accountId: string) => Promise<void>;
  totals: {
    paidImpressions: number;
    paidClicks: number;
    paidLeads: number;
    paidEngagements: number;
    organicImpressions: number;
    organicEngagements: number;
  };
}

export function useCompanyIntelligence(accessToken: string | null): UseCompanyIntelligenceReturn {
  const [companyData, setCompanyData] = useState<CompanyIntelligence[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookbackWindow, setLookbackWindow] = useState<LookbackWindow>('LAST_30_DAYS');
  const { toast } = useToast();

  const fetchCompanyIntelligence = useCallback(async (accountId: string) => {
    if (!accessToken || !accountId) {
      console.log('Missing accessToken or accountId, skipping fetch');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Fetching company intelligence with params:', { accountId, lookbackWindow });
      
      const { data, error: apiError } = await supabase.functions.invoke('linkedin-api', {
        body: { 
          action: 'get_company_intelligence', 
          accessToken,
          params: { 
            accountId,
            lookbackWindow,
          } 
        },
      });

      if (apiError) throw apiError;
      
      console.log('Company intelligence response:', data);
      
      if (data.error) {
        setError(data.error);
        toast({
          title: 'Access Restricted',
          description: data.error,
          variant: 'destructive',
        });
        setCompanyData([]);
        return;
      }
      
      const companies: CompanyIntelligence[] = data.elements || [];
      setCompanyData(companies);
      
    } catch (err: any) {
      console.error('Fetch company intelligence error:', err);
      setError(err.message || 'Failed to fetch company intelligence');
      toast({
        title: 'Error',
        description: err.message || 'Failed to fetch company intelligence',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, lookbackWindow, toast]);

  const totals = useMemo(() => {
    return companyData.reduce(
      (acc, company) => ({
        paidImpressions: acc.paidImpressions + company.paidImpressions,
        paidClicks: acc.paidClicks + company.paidClicks,
        paidLeads: acc.paidLeads + company.paidLeads,
        paidEngagements: acc.paidEngagements + company.paidEngagements,
        organicImpressions: acc.organicImpressions + company.organicImpressions,
        organicEngagements: acc.organicEngagements + company.organicEngagements,
      }),
      { paidImpressions: 0, paidClicks: 0, paidLeads: 0, paidEngagements: 0, organicImpressions: 0, organicEngagements: 0 }
    );
  }, [companyData]);

  return {
    companyData,
    isLoading,
    error,
    lookbackWindow,
    setLookbackWindow,
    fetchCompanyIntelligence,
    totals,
  };
}

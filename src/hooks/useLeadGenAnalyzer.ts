import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAIAnalysis } from './useAIAnalysis';

export interface LeadGenFormCreative {
  creativeId: string;
  name: string;
  cta: string;
  cpl: number;
  leads: number;
  spent: number;
  impressions: number;
  ctr: number;
  status: string;
}

export interface LeadGenForm {
  formUrn: string;
  formName: string;
  headline: string;
  description: string;
  fields: string[];
  thankYouHeadline?: string;
  metrics: {
    impressions: number;
    clicks: number;
    spent: number;
    leads: number;
    formOpens: number;
    ctr: number;
    cpl: number;
    lgfRate: number;
    last7d: { leads: number; cpl: number; spent: number };
    last30d: { leads: number; cpl: number; spent: number };
  };
  creatives: LeadGenFormCreative[];
}

export interface LeadGenAudienceItem {
  name: string;
  leads: number;
  cpl: number;
  impressions: number;
  spent: number;
}

export interface LeadGenOverviewData {
  campaigns: Array<{
    id: string;
    name: string;
    status: string;
    objectiveType: string;
    dailyBudget: { amount: string; currency: string } | null;
    totalBudget: { amount: string; currency: string } | null;
  }>;
  forms: LeadGenForm[];
  topCreativesByCpl: Array<LeadGenFormCreative & { formName: string }>;
  audienceInsights: {
    byJobFunction: LeadGenAudienceItem[];
    bySeniority: LeadGenAudienceItem[];
  };
  summary: {
    totalLeads: number;
    totalSpend: number;
    avgCpl: number;
    leads7d: number;
    cpl7d: number;
    leads30d: number;
    cpl30d: number;
    totalForms: number;
    totalCampaigns: number;
  };
}

export function useLeadGenAnalyzer(accessToken: string | null) {
  const [overviewData, setOverviewData] = useState<LeadGenOverviewData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null);
  const aiAnalysis = useAIAnalysis();

  const fetchAndAnalyze = useCallback(async (accountId: string, autoAnalyze = true) => {
    if (!accessToken || !accountId) return;

    setCurrentAccountId(accountId);
    setIsLoadingData(true);
    setDataError(null);
    aiAnalysis.clearHistory();

    try {
      const result = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_lead_gen_overview',
          accessToken,
          params: { accountId },
        },
      });

      if (result.error) {
        // Supabase wraps function errors — extract the real message
        let msg = 'Failed to fetch lead gen data';
        try {
          const ctx = (result.error as any).context;
          if (ctx && typeof ctx === 'object' && ctx.error) {
            msg = ctx.error;
          } else if (typeof ctx === 'string') {
            msg = ctx;
          } else {
            msg = result.error.message || msg;
          }
        } catch { /* use default */ }
        console.error('[useLeadGenAnalyzer] Edge function error:', result.error);
        throw new Error(msg);
      }

      const data: LeadGenOverviewData = result.data;
      if (!data || !data.summary) {
        console.error('[useLeadGenAnalyzer] Unexpected response shape:', data);
        throw new Error('Received empty or malformed response from edge function');
      }
      setOverviewData(data);

      if (autoAnalyze && (data.forms.length > 0 || data.summary.totalLeads > 0)) {
        const aiPayload = buildAIPayload(data);
        aiAnalysis.ask(
          'Analyze my lead generation campaigns. Audit each form (headline, description, fields, CTA alignment), identify CPL trends and fatigue signals, highlight best and worst performing creatives, and give me specific actions to improve CPL and lead volume.',
          aiPayload,
          'lead_gen_analysis',
        );
      }
    } catch (err) {
      console.error('[useLeadGenAnalyzer] Error:', err);
      setDataError(err instanceof Error ? err.message : 'Failed to fetch lead generation data');
    } finally {
      setIsLoadingData(false);
    }
  }, [accessToken, aiAnalysis]);

  const askFollowUp = useCallback((question: string) => {
    if (!overviewData) return;
    const aiPayload = buildAIPayload(overviewData);
    if (accessToken && currentAccountId) {
      aiAnalysis.ask(question, aiPayload, 'lead_gen_analysis', {
        mode: 'agentic',
        accountId: currentAccountId,
        accessToken,
      });
    } else {
      aiAnalysis.ask(question, aiPayload, 'lead_gen_analysis');
    }
  }, [overviewData, aiAnalysis, accessToken, currentAccountId]);

  return {
    overviewData,
    isLoadingData,
    dataError,
    fetchAndAnalyze,
    askFollowUp,
    ...aiAnalysis,
  };
}

function buildAIPayload(data: LeadGenOverviewData) {
  return {
    summary: data.summary,
    forms: data.forms.map(f => ({
      name: f.formName,
      headline: f.headline,
      description: f.description,
      fields: f.fields,
      fieldCount: f.fields.length,
      thankYouHeadline: f.thankYouHeadline,
      metrics: {
        leads30d: f.metrics.leads,
        cpl30d: +f.metrics.cpl.toFixed(2),
        leads7d: f.metrics.last7d.leads,
        cpl7d: +f.metrics.last7d.cpl.toFixed(2),
        cplTrend: f.metrics.last30d.cpl > 0
          ? +((f.metrics.last7d.cpl - f.metrics.last30d.cpl) / f.metrics.last30d.cpl * 100).toFixed(1)
          : 0,
        lgfRate: +f.metrics.lgfRate.toFixed(1),
        formOpens: f.metrics.formOpens,
        spent30d: +f.metrics.spent.toFixed(2),
      },
      topCreatives: f.creatives.slice(0, 5).map(c => ({
        name: c.name,
        cta: c.cta,
        leads: c.leads,
        cpl: +c.cpl.toFixed(2),
        ctr: +c.ctr.toFixed(2),
        status: c.status,
      })),
    })),
    audienceInsights: {
      byJobFunction: data.audienceInsights.byJobFunction.slice(0, 8).map(a => ({
        name: a.name,
        leads: a.leads,
        cpl: +a.cpl.toFixed(2),
        impressions: a.impressions,
      })),
      bySeniority: data.audienceInsights.bySeniority.slice(0, 6).map(a => ({
        name: a.name,
        leads: a.leads,
        cpl: +a.cpl.toFixed(2),
        impressions: a.impressions,
      })),
    },
    analyzedAt: new Date().toISOString(),
  };
}

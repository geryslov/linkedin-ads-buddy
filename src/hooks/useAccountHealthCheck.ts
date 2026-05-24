import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAIAnalysis } from './useAIAnalysis';

export interface HealthCheckData {
  budgetPacing: any;
  creativeFatigue: any;
  creativePerformance: any;
  leadGenOverview: any;
}

export function useAccountHealthCheck(accessToken: string | null) {
  const [healthData, setHealthData] = useState<HealthCheckData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null);
  const aiAnalysis = useAIAnalysis();

  const runHealthCheck = useCallback(async (accountId: string) => {
    if (!accessToken || !accountId) return;

    setCurrentAccountId(accountId);
    setIsLoadingData(true);
    setDataError(null);
    aiAnalysis.clearHistory();

    try {
      const now = new Date();
      const fmt = (d: Date) => d.toISOString().split('T')[0];
      const s30 = fmt(new Date(now.getTime() - 30 * 86400000));
      const s7 = fmt(new Date(now.getTime() - 7 * 86400000));
      const end = fmt(now);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      // Fetch all data in parallel
      const [pacingRes, fatigueRes, perfRes, leadGenRes] = await Promise.allSettled([
        supabase.functions.invoke('linkedin-api', {
          body: { action: 'get_budget_pacing', accessToken, params: { accountId } },
        }),
        supabase.functions.invoke('linkedin-api', {
          body: {
            action: 'get_creative_fatigue', accessToken,
            params: {
              accountId,
              dateRange: { start: s30, end },
              thresholds: { ctrDecline: 15, cplIncrease: 20, minImpressions: 500 },
            },
          },
        }),
        supabase.functions.invoke('linkedin-api', {
          body: {
            action: 'get_creative_performance_report', accessToken,
            params: {
              accountId,
              dateRanges: [
                { key: 'last7d', start: s7, end },
                { key: 'last30d', start: s30, end },
                { key: 'lastMonth', start: fmt(lastMonthStart), end: fmt(lastMonthEnd) },
              ],
            },
          },
        }),
        supabase.functions.invoke('linkedin-api', {
          body: { action: 'get_lead_gen_overview', accessToken, params: { accountId } },
        }),
      ]);

      const safeData = (r: PromiseSettledResult<any>) =>
        r.status === 'fulfilled' && !r.value.error ? r.value.data : null;

      const data: HealthCheckData = {
        budgetPacing: safeData(pacingRes),
        creativeFatigue: safeData(fatigueRes),
        creativePerformance: safeData(perfRes),
        leadGenOverview: safeData(leadGenRes),
      };

      setHealthData(data);

      // Build compact AI payload
      const aiPayload: Record<string, unknown> = {};

      if (data.budgetPacing) {
        aiPayload.budgetPacing = {
          spentThisMonth: data.budgetPacing.spentThisMonth,
          avgDailySpend: data.budgetPacing.avgDailySpend,
          projectedTotal: data.budgetPacing.projectedTotal,
          daysRemaining: data.budgetPacing.daysRemaining,
          spendTrend: data.budgetPacing.spendTrend,
        };
      }

      if (data.creativeFatigue?.creatives) {
        const creatives = data.creativeFatigue.creatives;
        aiPayload.creativeFatigue = {
          total: creatives.length,
          fatigued: creatives.filter((c: any) => c.status === 'fatigued').length,
          warning: creatives.filter((c: any) => c.status === 'warning').length,
          topIssues: creatives
            .filter((c: any) => c.status !== 'healthy')
            .slice(0, 8)
            .map((c: any) => ({
              name: c.creativeName,
              status: c.status,
              signals: c.signals,
              recommendation: c.recommendation,
              ctrTrend: c.metrics?.ctrTrend,
              impressionTrend: c.metrics?.impressionTrend,
            })),
        };
      }

      if (data.creativePerformance?.elements) {
        const els = data.creativePerformance.elements;
        aiPayload.creativePerformance = {
          totalCreatives: els.length,
          activeCount: els.filter((e: any) => e.creativeStatus === 'ACTIVE').length,
          top5BySpend: els
            .sort((a: any, b: any) => {
              const aSpend = a.periods?.last7d?.costInLocalCurrency || 0;
              const bSpend = b.periods?.last7d?.costInLocalCurrency || 0;
              return parseFloat(bSpend) - parseFloat(aSpend);
            })
            .slice(0, 5)
            .map((e: any) => ({
              name: e.creativeName,
              status: e.creativeStatus,
              campaign: e.campaignName,
              last7d: {
                spend: parseFloat(e.periods?.last7d?.costInLocalCurrency || '0'),
                impressions: e.periods?.last7d?.impressions || 0,
                clicks: e.periods?.last7d?.clicks || 0,
                leads: e.periods?.last7d?.leads || 0,
              },
            })),
        };
      }

      if (data.leadGenOverview?.summary) {
        aiPayload.leadGen = {
          summary: data.leadGenOverview.summary,
          topForms: (data.leadGenOverview.forms || []).slice(0, 3).map((f: any) => ({
            name: f.formName,
            leads: f.metrics?.leads,
            cpl: f.metrics?.cpl?.toFixed(2),
            cpl7d: f.metrics?.last7d?.cpl?.toFixed(2),
            lgfRate: f.metrics?.lgfRate?.toFixed(1),
          })),
        };
      }

      // Auto-trigger AI analysis
      aiAnalysis.ask(
        'Run a full account health check. Diagnose issues, rank by severity, identify what\'s working, and give me specific actions to take this week.',
        aiPayload,
        'account_health',
      );
    } catch (err) {
      console.error('[useAccountHealthCheck] Error:', err);
      setDataError(err instanceof Error ? err.message : 'Failed to fetch account data');
    } finally {
      setIsLoadingData(false);
    }
  }, [accessToken, aiAnalysis]);

  const askFollowUp = useCallback((question: string) => {
    if (!healthData || !accessToken || !currentAccountId) return;
    aiAnalysis.ask(question, null, 'account_health', {
      mode: 'agentic',
      accountId: currentAccountId,
      accessToken,
    });
  }, [healthData, aiAnalysis, accessToken, currentAccountId]);

  return {
    healthData,
    isLoadingData,
    dataError,
    runHealthCheck,
    askFollowUp,
    ...aiAnalysis,
  };
}

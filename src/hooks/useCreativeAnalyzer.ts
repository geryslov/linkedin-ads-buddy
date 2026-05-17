import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAIAnalysis } from './useAIAnalysis';
import type { CreativePerformanceRow } from './useCreativePerformanceReport';
import type { CreativeFatigueItem } from './useCreativeFatigue';

export interface CreativeAnalysisData {
  performanceRows: CreativePerformanceRow[];
  fatigueItems: CreativeFatigueItem[];
  summary: {
    totalCreatives: number;
    activeCreatives: number;
    fatigued: number;
    warning: number;
    healthy: number;
    totalSpend7d: number;
    totalImpressions7d: number;
    avgCtr7d: number;
  };
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDateRanges() {
  const now = new Date();
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return [
    { key: 'last7d', start: formatDate(new Date(now.getTime() - 7 * 86400000)), end: formatDate(now) },
    { key: 'last14d', start: formatDate(new Date(now.getTime() - 14 * 86400000)), end: formatDate(now) },
    { key: 'last30d', start: formatDate(new Date(now.getTime() - 30 * 86400000)), end: formatDate(now) },
    { key: 'lastMonth', start: formatDate(lastMonthStart), end: formatDate(lastMonthEnd) },
  ];
}

function toMetrics(p: any) {
  if (!p) return { impressions: 0, clicks: 0, spent: 0, leads: 0, ctr: 0, cpl: 0 };
  return {
    impressions: p.impressions || 0,
    clicks: p.clicks || 0,
    spent: parseFloat(p.costInLocalCurrency || p.spent || '0'),
    leads: p.leads || 0,
    ctr: p.impressions > 0 ? ((p.clicks || 0) / p.impressions) * 100 : 0,
    cpl: p.leads > 0 ? parseFloat(p.costInLocalCurrency || p.spent || '0') / p.leads : 0,
  };
}

export function useCreativeAnalyzer(accessToken: string | null) {
  const [analysisData, setAnalysisData] = useState<CreativeAnalysisData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const aiAnalysis = useAIAnalysis();

  const fetchAndAnalyze = useCallback(async (accountId: string, autoAnalyze = true) => {
    if (!accessToken || !accountId) return;

    setIsLoadingData(true);
    setDataError(null);
    aiAnalysis.clearHistory();

    try {
      // Fetch performance data and fatigue data in parallel
      const [perfResult, fatigueResult] = await Promise.all([
        supabase.functions.invoke('linkedin-api', {
          body: {
            action: 'get_creative_performance_report',
            accessToken,
            params: { accountId, dateRanges: getDateRanges() },
          },
        }),
        supabase.functions.invoke('linkedin-api', {
          body: {
            action: 'get_creative_fatigue',
            accessToken,
            params: {
              accountId,
              dateRange: {
                start: formatDate(new Date(Date.now() - 30 * 86400000)),
                end: formatDate(new Date()),
              },
              thresholds: { ctrDecline: 15, cplIncrease: 20, minImpressions: 500 },
            },
          },
        }),
      ]);

      // Process performance data
      const perfElements = perfResult.data?.elements || [];
      const byName = new Map<string, any>();

      for (const el of perfElements) {
        const name = el.creativeName || `Creative ${el.creativeId}`;
        if (!byName.has(name)) {
          byName.set(name, {
            imageUrl: el.imageUrl, type: el.type || 'UNKNOWN',
            creativeStatus: el.creativeStatus || 'UNKNOWN',
            campaigns: new Map(), totals: {},
          });
        }
        const entry = byName.get(name)!;
        const campKey = el.campaignName || 'Unknown';
        if (!entry.campaigns.has(campKey)) {
          entry.campaigns.set(campKey, {
            campaignName: campKey, campaignStatus: el.campaignStatus || 'UNKNOWN',
            creativeStatus: el.creativeStatus || 'UNKNOWN', objectiveType: el.objectiveType || '', periods: {},
          });
        }
        const camp = entry.campaigns.get(campKey)!;
        for (const [key, pd] of Object.entries(el.periods || {})) {
          const p = pd as any;
          const spent = parseFloat(p.costInLocalCurrency || p.spent || '0');
          const ce = camp.periods[key] || { impressions: 0, clicks: 0, spent: 0, leads: 0 };
          ce.impressions += p.impressions || 0;
          ce.clicks += p.clicks || 0;
          ce.spent += spent;
          ce.leads += p.leads || 0;
          camp.periods[key] = ce;
          const te = entry.totals[key] || { impressions: 0, clicks: 0, spent: 0, leads: 0 };
          te.impressions += p.impressions || 0;
          te.clicks += p.clicks || 0;
          te.spent += spent;
          te.leads += p.leads || 0;
          entry.totals[key] = te;
        }
      }

      const performanceRows: CreativePerformanceRow[] = [];
      byName.forEach((v, name) => {
        const campaigns: any[] = [];
        v.campaigns.forEach((c: any) => {
          campaigns.push({
            campaignName: c.campaignName, campaignStatus: c.campaignStatus,
            creativeStatus: c.creativeStatus, objectiveType: c.objectiveType,
            last7d: toMetrics(c.periods['last7d']), last14d: toMetrics(c.periods['last14d']),
            last30d: toMetrics(c.periods['last30d']), lastMonth: toMetrics(c.periods['lastMonth']),
          });
        });
        performanceRows.push({
          creativeName: name, imageUrl: v.imageUrl, type: v.type,
          creativeStatus: v.creativeStatus, campaignCount: campaigns.length, campaigns,
          last7d: toMetrics(v.totals['last7d']), last14d: toMetrics(v.totals['last14d']),
          last30d: toMetrics(v.totals['last30d']), lastMonth: toMetrics(v.totals['lastMonth']),
        });
      });

      // Process fatigue data
      const fatigueItems: CreativeFatigueItem[] = fatigueResult.data?.creatives || [];

      // Compute summary
      const activeRows = performanceRows.filter(r => r.creativeStatus === 'ACTIVE' || r.last7d.impressions > 0);
      const totalSpend7d = activeRows.reduce((s, r) => s + r.last7d.spent, 0);
      const totalImpressions7d = activeRows.reduce((s, r) => s + r.last7d.impressions, 0);
      const totalClicks7d = activeRows.reduce((s, r) => s + r.last7d.clicks, 0);

      const data: CreativeAnalysisData = {
        performanceRows,
        fatigueItems,
        summary: {
          totalCreatives: performanceRows.length,
          activeCreatives: activeRows.length,
          fatigued: fatigueItems.filter(f => f.status === 'fatigued').length,
          warning: fatigueItems.filter(f => f.status === 'warning').length,
          healthy: fatigueItems.filter(f => f.status === 'healthy').length,
          totalSpend7d,
          totalImpressions7d,
          avgCtr7d: totalImpressions7d > 0 ? (totalClicks7d / totalImpressions7d) * 100 : 0,
        },
      };

      setAnalysisData(data);

      // Auto-trigger AI analysis
      if (autoAnalyze && performanceRows.length > 0) {
        const aiData = buildAIPayload(performanceRows, fatigueItems);
        aiAnalysis.ask(
          'Analyze all my creatives. Find fatigue patterns, identify what creative themes/messaging are working vs not, and give me specific actions to take. Focus on engagement objective campaigns.',
          aiData,
          'creative_analysis',
        );
      }
    } catch (err) {
      console.error('[useCreativeAnalyzer] Error:', err);
      setDataError('Failed to fetch creative data for analysis');
    } finally {
      setIsLoadingData(false);
    }
  }, [accessToken, aiAnalysis]);

  const askFollowUp = useCallback((question: string) => {
    if (!analysisData) return;
    const aiData = buildAIPayload(analysisData.performanceRows, analysisData.fatigueItems);
    aiAnalysis.ask(question, aiData, 'creative_analysis');
  }, [analysisData, aiAnalysis]);

  return {
    analysisData,
    isLoadingData,
    dataError,
    fetchAndAnalyze,
    askFollowUp,
    ...aiAnalysis,
  };
}

/** Build a compact payload for the AI — include the most relevant data without overwhelming the context */
function buildAIPayload(rows: CreativePerformanceRow[], fatigueItems: CreativeFatigueItem[]) {
  // Performance overview: compact format with trend indicators
  const performance = rows
    .filter(r => r.last30d.impressions > 0)
    .map(r => {
      const ctrTrend = r.last30d.ctr > 0 ? ((r.last7d.ctr - r.last30d.ctr) / r.last30d.ctr * 100) : 0;
      const deliveryTrend = r.last30d.impressions > 0
        ? ((r.last7d.impressions * (30 / 7)) - r.last30d.impressions) / r.last30d.impressions * 100
        : 0;

      return {
        name: r.creativeName,
        type: r.type,
        status: r.creativeStatus,
        campaigns: r.campaigns.map((c: any) => ({
          name: c.campaignName,
          status: c.campaignStatus,
          objective: c.objectiveType || 'unknown',
        })),
        metrics: {
          last7d: { impressions: r.last7d.impressions, clicks: r.last7d.clicks, ctr: +r.last7d.ctr.toFixed(2), spend: +r.last7d.spent.toFixed(2), leads: r.last7d.leads },
          last14d: { impressions: r.last14d.impressions, clicks: r.last14d.clicks, ctr: +r.last14d.ctr.toFixed(2), spend: +r.last14d.spent.toFixed(2), leads: r.last14d.leads },
          last30d: { impressions: r.last30d.impressions, clicks: r.last30d.clicks, ctr: +r.last30d.ctr.toFixed(2), spend: +r.last30d.spent.toFixed(2), leads: r.last30d.leads },
          lastMonth: { impressions: r.lastMonth.impressions, clicks: r.lastMonth.clicks, ctr: +r.lastMonth.ctr.toFixed(2), spend: +r.lastMonth.spent.toFixed(2), leads: r.lastMonth.leads },
        },
        trends: {
          ctrChange7dvs30d: +ctrTrend.toFixed(1),
          deliveryChange: +deliveryTrend.toFixed(1),
        },
      };
    });

  // Fatigue signals: only include items with signals
  const fatigue = fatigueItems
    .filter(f => f.status !== 'healthy' || f.signals.length > 0)
    .map(f => ({
      name: f.creativeName,
      campaign: f.campaignName,
      objective: f.objectiveType,
      status: f.status,
      signals: f.signals,
      metrics: {
        avgCtr: +f.metrics.avgCtr.toFixed(2),
        ctrTrend: +f.metrics.ctrTrend.toFixed(1),
        impressionTrend: +f.metrics.impressionTrend.toFixed(1),
        totalImpressions: f.metrics.totalImpressions,
        totalSpend: +f.metrics.totalSpend.toFixed(2),
      },
      recommendation: f.recommendation,
    }));

  return { performance, fatigue, totalCreatives: rows.length, analyzedAt: new Date().toISOString() };
}

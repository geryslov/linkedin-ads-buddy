import type { WeeklyReportData } from '@/hooks/useWeeklyReport';

export interface KpiSnapshot {
  weekStart: string;
  weekEnd: string;
  lastWeekStart: string;
  lastWeekEnd: string;
  thisWeek: { impressions: number; clicks: number; spent: number; leads: number; ctr: number; cpl: number };
  lastWeek: { impressions: number; clicks: number; spent: number; leads: number; ctr: number; cpl: number };
  deltas: {
    spent: number | null; impressions: number | null; clicks: number | null;
    leads: number | null; ctr: number | null; cpl: number | null;
  };
}

export interface ClientReportPayload {
  weekRange: WeeklyReportData['weekRange'];
  summary: WeeklyReportData['summary'];
  topCreatives: Array<{
    name: string; status: string; type: string;
    thisWeek: { spent: number; impressions: number; clicks: number; leads: number; ctr: number; cpl: number };
    lastWeek: { spent: number; impressions: number; clicks: number; leads: number; ctr: number; cpl: number };
    pctSpentChange: number | null; pctCplChange: number | null;
  }>;
  topCampaigns: Array<{
    name: string; status: string; objective: string;
    thisWeek: { spent: number; leads: number; ctr: number; cpl: number };
    lastWeek: { spent: number; leads: number; ctr: number; cpl: number };
    pctSpentChange: number | null; pctCplChange: number | null;
  }>;
  leadForms: Array<{
    name: string;
    thisWeek: { leads: number; cpl: number; spent: number };
    pctCplChange: number | null;
  }>;
  topDemographics: {
    jobTitles: string[];
    seniorities: string[];
    industries: string[];
  };
}

// Snapshot used both to render the KPI cards on the client view AND for later inspection
export function extractKpiSnapshot(data: WeeklyReportData): KpiSnapshot {
  return {
    weekStart: data.weekRange.thisWeek.start,
    weekEnd: data.weekRange.thisWeek.end,
    lastWeekStart: data.weekRange.lastWeek.start,
    lastWeekEnd: data.weekRange.lastWeek.end,
    thisWeek: {
      impressions: data.summary.thisWeek.impressions,
      clicks: data.summary.thisWeek.clicks,
      spent: data.summary.thisWeek.spent,
      leads: data.summary.thisWeek.leads,
      ctr: data.summary.thisWeek.ctr,
      cpl: data.summary.thisWeek.cpl,
    },
    lastWeek: {
      impressions: data.summary.lastWeek.impressions,
      clicks: data.summary.lastWeek.clicks,
      spent: data.summary.lastWeek.spent,
      leads: data.summary.lastWeek.leads,
      ctr: data.summary.lastWeek.ctr,
      cpl: data.summary.lastWeek.cpl,
    },
    deltas: {
      spent: data.summary.pctSpentChange,
      impressions: data.summary.pctImpressionsChange,
      clicks: data.summary.pctClicksChange,
      leads: data.summary.pctLeadsChange,
      ctr: data.summary.pctCtrChange,
      cpl: data.summary.pctCplChange,
    },
  };
}

// Compact payload for Claude — top-N ranked by spend, minimal fields.
export function serializeReportForClaude(data: WeeklyReportData): ClientReportPayload {
  const stripUrn = (name: string) => name.replace(/^urn:li:[^:]+:/i, '');
  const round2 = (n: number) => Math.round(n * 100) / 100;

  return {
    weekRange: data.weekRange,
    summary: data.summary,
    topCreatives: [...data.byCreative]
      .sort((a, b) => b.thisWeek.spent - a.thisWeek.spent)
      .slice(0, 8)
      .map(c => ({
        name: c.creativeName,
        status: c.status,
        type: c.type,
        thisWeek: {
          spent: round2(c.thisWeek.spent),
          impressions: c.thisWeek.impressions,
          clicks: c.thisWeek.clicks,
          leads: c.thisWeek.leads,
          ctr: round2(c.thisWeek.ctr),
          cpl: round2(c.thisWeek.cpl),
        },
        lastWeek: {
          spent: round2(c.lastWeek.spent),
          impressions: c.lastWeek.impressions,
          clicks: c.lastWeek.clicks,
          leads: c.lastWeek.leads,
          ctr: round2(c.lastWeek.ctr),
          cpl: round2(c.lastWeek.cpl),
        },
        pctSpentChange: c.pctSpentChange,
        pctCplChange: c.pctCplChange,
      })),
    topCampaigns: [...data.byCampaign]
      .sort((a, b) => b.thisWeek.spent - a.thisWeek.spent)
      .slice(0, 8)
      .map(c => ({
        name: c.campaignName,
        status: c.status,
        objective: c.objectiveType,
        thisWeek: {
          spent: round2(c.thisWeek.spent),
          leads: c.thisWeek.leads,
          ctr: round2(c.thisWeek.ctr),
          cpl: round2(c.thisWeek.cpl),
        },
        lastWeek: {
          spent: round2(c.lastWeek.spent),
          leads: c.lastWeek.leads,
          ctr: round2(c.lastWeek.ctr),
          cpl: round2(c.lastWeek.cpl),
        },
        pctSpentChange: c.pctSpentChange,
        pctCplChange: c.pctCplChange,
      })),
    leadForms: [...data.byLeadForm]
      .sort((a, b) => b.thisWeek.leads - a.thisWeek.leads)
      .slice(0, 5)
      .map(f => ({
        name: f.formName,
        thisWeek: {
          leads: f.thisWeek.leads,
          cpl: round2(f.thisWeek.cpl),
          spent: round2(f.thisWeek.spent),
        },
        pctCplChange: f.pctCplChange,
      })),
    topDemographics: {
      jobTitles: data.demographics.jobTitle.slice(0, 5).map(d => stripUrn(d.name)),
      seniorities: data.demographics.seniority.slice(0, 4).map(d => stripUrn(d.name)),
      industries: data.demographics.industry.slice(0, 4).map(d => stripUrn(d.name)),
    },
  };
}

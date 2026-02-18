import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { LeadGenFormData, LeadGenFormCreative } from '@/hooks/useLeadGenFormsReport';
import { exportToCSV } from '@/lib/exportUtils';
import { useToast } from '@/hooks/use-toast';

interface LeadGenFormsTableProps {
  data: LeadGenFormData[];
  isLoading: boolean;
}

interface AggregatedCreative {
  creativeName: string;
  impressions: number;
  clicks: number;
  spent: number;
  leads: number;
  formOpens: number;
  ctr: number;
  cpc: number;
  cpl: number;
  lgfRate: number;
  instances: LeadGenFormCreative[]; // individual creatives with same name
}

/** Row for an aggregated creative name, drills down to IDs + campaigns */
function AggregatedCreativeRow({ agg }: { agg: AggregatedCreative }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <tr
        className="hover:bg-muted/40 border-b border-border/40 cursor-pointer"
        onClick={() => setIsOpen((v) => !v)}
      >
        <td className="p-2 w-6">
          {isOpen
            ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
            : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        </td>
        <td className="p-2 font-medium text-xs">{agg.creativeName}</td>
        <td className="p-2 text-right tabular-nums text-xs">{agg.impressions.toLocaleString()}</td>
        <td className="p-2 text-right tabular-nums text-xs">{agg.clicks.toLocaleString()}</td>
        <td className="p-2 text-right tabular-nums text-xs">${agg.spent.toFixed(2)}</td>
        <td className="p-2 text-right tabular-nums text-xs font-medium">{agg.leads}</td>
        <td className="p-2 text-right tabular-nums text-xs">{agg.ctr.toFixed(2)}%</td>
        <td className="p-2 text-right tabular-nums text-xs">${agg.cpc.toFixed(2)}</td>
        <td className="p-2 text-right tabular-nums text-xs">${agg.cpl.toFixed(2)}</td>
        <td className="p-2 text-right tabular-nums text-xs">
          {agg.formOpens > 0 ? `${agg.lgfRate.toFixed(1)}%` : '—'}
        </td>
      </tr>
      {isOpen && agg.instances.map((c) => (
        <tr key={c.creativeId} className="bg-muted/50 border-b border-border/40">
          <td />
          <td className="px-4 py-2 text-xs">
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground font-mono">
                ID: <span className="text-foreground select-all">{c.creativeId}</span>
              </span>
              <span className="text-muted-foreground text-[11px]">
                Campaign: <span className="text-foreground">{c.campaignName || c.campaignId || '—'}</span>
              </span>
            </div>
          </td>
          <td className="p-2 text-right tabular-nums text-xs">{c.impressions.toLocaleString()}</td>
          <td className="p-2 text-right tabular-nums text-xs">{c.clicks.toLocaleString()}</td>
          <td className="p-2 text-right tabular-nums text-xs">${c.spent.toFixed(2)}</td>
          <td className="p-2 text-right tabular-nums text-xs font-medium">{c.leads}</td>
          <td className="p-2 text-right tabular-nums text-xs">{c.ctr.toFixed(2)}%</td>
          <td className="p-2 text-right tabular-nums text-xs">${c.cpc.toFixed(2)}</td>
          <td className="p-2 text-right tabular-nums text-xs">${c.cpl.toFixed(2)}</td>
          <td className="p-2 text-right tabular-nums text-xs">
            {c.formOpens > 0 ? `${c.lgfRate.toFixed(1)}%` : '—'}
          </td>
        </tr>
      ))}
    </>
  );
}

/** Creatives sub-table shown when a form row is expanded — aggregated by creative name */
function CreativesSubTable({ creatives }: { creatives: LeadGenFormCreative[] }) {
  // Aggregate by creative name
  const aggregated = useMemo<AggregatedCreative[]>(() => {
    const map = new Map<string, AggregatedCreative>();
    for (const c of creatives) {
      const key = c.creativeName || c.creativeId;
      if (!map.has(key)) {
        map.set(key, {
          creativeName: c.creativeName || c.creativeId,
          impressions: 0, clicks: 0, spent: 0, leads: 0, formOpens: 0,
          ctr: 0, cpc: 0, cpl: 0, lgfRate: 0,
          instances: [],
        });
      }
      const agg = map.get(key)!;
      agg.impressions += c.impressions;
      agg.clicks += c.clicks;
      agg.spent += c.spent;
      agg.leads += c.leads;
      agg.formOpens += c.formOpens;
      agg.instances.push(c);
    }
    // Compute derived metrics
    for (const agg of map.values()) {
      agg.ctr = agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0;
      agg.cpc = agg.clicks > 0 ? agg.spent / agg.clicks : 0;
      agg.cpl = agg.leads > 0 ? agg.spent / agg.leads : 0;
      agg.lgfRate = agg.formOpens > 0 ? (agg.leads / agg.formOpens) * 100 : 0;
    }
    return Array.from(map.values()).sort((a, b) => b.leads - a.leads || b.impressions - a.impressions);
  }, [creatives]);

  return (
    <div className="bg-muted/30 py-3 px-6 mb-1">
      <p className="text-xs font-medium text-muted-foreground mb-2">
        {aggregated.length} creative{aggregated.length !== 1 ? 's' : ''} — click a row to reveal ID &amp; campaign
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-separate border-spacing-0 min-w-[860px]">
          <thead>
            <tr className="bg-muted/50">
              <th className="w-6 border-b border-border" />
              <th className="text-left p-2 font-semibold border-b border-border min-w-[220px]">Creative Name</th>
              <th className="text-right p-2 font-semibold border-b border-border">Impressions</th>
              <th className="text-right p-2 font-semibold border-b border-border">Clicks</th>
              <th className="text-right p-2 font-semibold border-b border-border">Spent</th>
              <th className="text-right p-2 font-semibold border-b border-border">Leads</th>
              <th className="text-right p-2 font-semibold border-b border-border">CTR</th>
              <th className="text-right p-2 font-semibold border-b border-border">CPC</th>
              <th className="text-right p-2 font-semibold border-b border-border">CPL</th>
              <th className="text-right p-2 font-semibold border-b border-border">LGF Rate</th>
            </tr>
          </thead>
          <tbody>
            {aggregated.map((agg) => (
              <AggregatedCreativeRow key={agg.creativeName} agg={agg} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FormRow({ form, colCount }: { form: LeadGenFormData; colCount: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const handleExportCreatives = (e: React.MouseEvent) => {
    e.stopPropagation();
    const columns = [
      { key: 'creativeName', label: 'Creative Name' },
      { key: 'creativeId', label: 'Creative ID' },
      { key: 'campaignName', label: 'Campaign Name' },
      { key: 'impressions', label: 'Impressions' },
      { key: 'clicks', label: 'Clicks' },
      { key: 'spent', label: 'Spent' },
      { key: 'leads', label: 'Leads' },
      { key: 'ctr', label: 'CTR (%)' },
      { key: 'cpc', label: 'CPC' },
      { key: 'cpl', label: 'CPL' },
      { key: 'lgfRate', label: 'LGF Rate (%)' },
    ];
    exportToCSV(form.creatives, `lead_form_${form.formUrn.split(':').pop()}_creatives`, columns);
    toast({ title: 'Export successful', description: `${form.creatives.length} creatives exported` });
  };

  const hasCreatives = form.creatives.length > 0;

  return (
    <>
      <TableRow
        className={`hover:bg-muted/40 transition-colors ${hasCreatives ? 'cursor-pointer' : ''} ${isOpen ? 'bg-muted/20' : ''}`}
        onClick={hasCreatives ? () => setIsOpen(!isOpen) : undefined}
      >
        {/* Expand */}
        <TableCell className="w-8 p-2">
          {hasCreatives && (
            isOpen
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
        {/* Form Name */}
        <TableCell className="font-medium text-sm min-w-[160px]">{form.formName}</TableCell>
        {/* Metrics */}
        <TableCell className="text-right tabular-nums">{form.impressions.toLocaleString()}</TableCell>
        <TableCell className="text-right tabular-nums">{form.clicks.toLocaleString()}</TableCell>
        <TableCell className="text-right tabular-nums">${form.spent.toFixed(2)}</TableCell>
        <TableCell className="text-right tabular-nums font-semibold text-primary">{form.leads}</TableCell>
        <TableCell className="text-right tabular-nums">{form.formOpens}</TableCell>
        <TableCell className="text-right tabular-nums">{form.ctr.toFixed(2)}%</TableCell>
        <TableCell className="text-right tabular-nums">${form.cpc.toFixed(2)}</TableCell>
        <TableCell className="text-right tabular-nums">${form.cpl.toFixed(2)}</TableCell>
        <TableCell className="text-right tabular-nums">
          {form.formOpens > 0 ? `${form.lgfRate.toFixed(1)}%` : '—'}
        </TableCell>
        <TableCell className="text-right tabular-nums text-muted-foreground">{form.creatives.length}</TableCell>
        {/* Export */}
        <TableCell className="w-10 p-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleExportCreatives}
            title="Export creatives"
          >
            <Download className="h-3 w-3" />
          </Button>
        </TableCell>
      </TableRow>
      {/* Sub-table row */}
      {isOpen && (
        <tr>
          <td colSpan={colCount} className="p-0 border-b border-border/40">
            <CreativesSubTable creatives={form.creatives} />
          </td>
        </tr>
      )}
    </>
  );
}

export function LeadGenFormsTable({ data, isLoading }: LeadGenFormsTableProps) {
  const { toast } = useToast();
  // 1 expand + 1 name + 9 metrics + 1 creatives count + 1 export = 13
  const COL_COUNT = 13;

  const handleExportAll = () => {
    const columns = [
      { key: 'formName', label: 'Form Name' },
      { key: 'formUrn', label: 'Form URN' },
      { key: 'impressions', label: 'Impressions' },
      { key: 'clicks', label: 'Clicks' },
      { key: 'spent', label: 'Spent' },
      { key: 'leads', label: 'Leads' },
      { key: 'formOpens', label: 'Form Opens' },
      { key: 'ctr', label: 'CTR (%)' },
      { key: 'cpc', label: 'CPC' },
      { key: 'cpl', label: 'CPL' },
      { key: 'lgfRate', label: 'LGF Rate (%)' },
      { key: 'creativesCount', label: 'Connected Creatives' },
    ];
    const exportData = data.map(form => ({ ...form, creativesCount: form.creatives.length }));
    exportToCSV(exportData, 'lead_gen_forms_report', columns);
    toast({ title: 'Export successful', description: `${data.length} forms exported` });
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No lead gen forms found with activity in this date range.</p>
        <p className="text-sm mt-2">Try expanding your date range or check that your creatives have lead gen forms attached.</p>
      </div>
    );
  }

  // Summary totals
  const summary = data.reduce((acc, form) => ({
    impressions: acc.impressions + form.impressions,
    clicks: acc.clicks + form.clicks,
    spent: acc.spent + form.spent,
    leads: acc.leads + form.leads,
    formOpens: acc.formOpens + form.formOpens,
    creatives: acc.creatives + form.creatives.length,
  }), { impressions: 0, clicks: 0, spent: 0, leads: 0, formOpens: 0, creatives: 0 });

  const summaryCtr = summary.impressions > 0 ? (summary.clicks / summary.impressions) * 100 : 0;
  const summaryCpc = summary.clicks > 0 ? summary.spent / summary.clicks : 0;
  const summaryCpl = summary.leads > 0 ? summary.spent / summary.leads : 0;
  const summaryLgfRate = summary.formOpens > 0 ? (summary.leads / summary.formOpens) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleExportAll}>
          <Download className="mr-2 h-4 w-4" />
          Export All Forms
        </Button>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-[1100px]">
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-8" />
              <TableHead className="min-w-[160px]">Form Name</TableHead>
              <TableHead className="text-right">Impressions</TableHead>
              <TableHead className="text-right">Clicks</TableHead>
              <TableHead className="text-right">Spent</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">Form Opens</TableHead>
              <TableHead className="text-right">CTR</TableHead>
              <TableHead className="text-right">CPC</TableHead>
              <TableHead className="text-right">CPL</TableHead>
              <TableHead className="text-right">LGF Rate</TableHead>
              <TableHead className="text-right">Creatives</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((form) => (
              <FormRow key={form.formUrn} form={form} colCount={COL_COUNT} />
            ))}
            {/* Summary row */}
            <TableRow className="bg-muted/50 font-semibold border-t-2 border-border">
              <TableCell />
              <TableCell>Summary ({data.length} forms)</TableCell>
              <TableCell className="text-right tabular-nums">{summary.impressions.toLocaleString()}</TableCell>
              <TableCell className="text-right tabular-nums">{summary.clicks.toLocaleString()}</TableCell>
              <TableCell className="text-right tabular-nums">${summary.spent.toFixed(2)}</TableCell>
              <TableCell className="text-right tabular-nums text-primary">{summary.leads}</TableCell>
              <TableCell className="text-right tabular-nums">{summary.formOpens}</TableCell>
              <TableCell className="text-right tabular-nums">{summaryCtr.toFixed(2)}%</TableCell>
              <TableCell className="text-right tabular-nums">${summaryCpc.toFixed(2)}</TableCell>
              <TableCell className="text-right tabular-nums">${summaryCpl.toFixed(2)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {summary.formOpens > 0 ? `${summaryLgfRate.toFixed(1)}%` : '—'}
              </TableCell>
              <TableCell className="text-right tabular-nums">{summary.creatives}</TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

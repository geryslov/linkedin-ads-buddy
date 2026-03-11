import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Download, Activity, TrendingUp } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { LeadGenFormData, LeadGenFormCreative } from '@/hooks/useLeadGenFormsReport';
import { exportToCSV } from '@/lib/exportUtils';
import { useToast } from '@/hooks/use-toast';
import { formatNumber, formatCurrency } from '@/lib/utils';

interface LeadGenFormsTableProps {
  data: LeadGenFormData[];
  isLoading: boolean;
  selectedFormUrn?: string;
  onSelectForm?: (formUrn: string, formName: string) => void;
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
  status?: string;
  instances: LeadGenFormCreative[];
}

function StatusBadge({ status }: { status?: string }) {
  if (!status || status === 'UNKNOWN')
    return <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-inset ring-border">Unknown</span>;
  if (status === 'ACTIVE')
    return <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 ring-1 ring-inset ring-emerald-500/20"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Active</span>;
  if (status === 'PAUSED')
    return <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 ring-1 ring-inset ring-amber-500/20"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />Paused</span>;
  if (status === 'ARCHIVED' || status === 'COMPLETED')
    return <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-inset ring-border">{status.charAt(0) + status.slice(1).toLowerCase()}</span>;
  return <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-inset ring-border">{status}</span>;
}

function MetricPill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`flex flex-col items-center rounded-lg px-4 py-2.5 ${accent ? 'bg-primary/10 ring-1 ring-primary/20' : 'bg-muted/60'}`}>
      <span className={`text-base font-bold tabular-nums ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mt-0.5">{label}</span>
    </div>
  );
}

function AggregatedCreativeRow({ agg }: { agg: AggregatedCreative }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <tr
        className="group hover:bg-muted/30 border-b border-border/30 cursor-pointer transition-colors"
        onClick={() => setIsOpen((v) => !v)}
      >
        <td className="p-2 w-6 pl-3">
          <span className="text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
            {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </span>
        </td>
        <td className="p-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground/90">{agg.creativeName}</span>
            <StatusBadge status={agg.status} />
          </div>
        </td>
        <td className="p-2 text-right tabular-nums text-xs text-muted-foreground">{formatNumber(agg.impressions)}</td>
        <td className="p-2 text-right tabular-nums text-xs text-muted-foreground">{formatNumber(agg.clicks)}</td>
        <td className="p-2 text-right tabular-nums text-xs text-muted-foreground">{formatCurrency(agg.spent)}</td>
        <td className="p-2 text-right tabular-nums text-xs font-semibold text-primary">{formatNumber(agg.leads)}</td>
        <td className="p-2 text-right tabular-nums text-xs text-muted-foreground">{agg.ctr.toFixed(2)}%</td>
        <td className="p-2 text-right tabular-nums text-xs text-muted-foreground">{formatCurrency(agg.cpc)}</td>
        <td className="p-2 text-right tabular-nums text-xs text-muted-foreground">{formatCurrency(agg.cpl)}</td>
        <td className="p-2 text-right tabular-nums text-xs text-muted-foreground">
          {agg.formOpens > 0 ? `${agg.lgfRate.toFixed(1)}%` : '—'}
        </td>
      </tr>
      {isOpen && agg.instances.map((c) => (
        <tr key={c.creativeId} className="bg-muted/20 border-b border-border/20">
          <td />
          <td className="px-4 py-2 text-xs">
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground font-mono text-[11px]">
                ID: <span className="text-foreground/80 select-all">{c.creativeId}</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-[11px]">
                  Campaign: <span className="text-foreground/80">{c.campaignName || c.campaignId || '—'}</span>
                </span>
                <StatusBadge status={c.status} />
              </div>
            </div>
          </td>
          <td className="p-2 text-right tabular-nums text-xs text-muted-foreground">{formatNumber(c.impressions)}</td>
          <td className="p-2 text-right tabular-nums text-xs text-muted-foreground">{formatNumber(c.clicks)}</td>
          <td className="p-2 text-right tabular-nums text-xs text-muted-foreground">{formatCurrency(c.spent)}</td>
          <td className="p-2 text-right tabular-nums text-xs font-semibold text-primary">{formatNumber(c.leads)}</td>
          <td className="p-2 text-right tabular-nums text-xs text-muted-foreground">{c.ctr.toFixed(2)}%</td>
          <td className="p-2 text-right tabular-nums text-xs text-muted-foreground">{formatCurrency(c.cpc)}</td>
          <td className="p-2 text-right tabular-nums text-xs text-muted-foreground">{formatCurrency(c.cpl)}</td>
          <td className="p-2 text-right tabular-nums text-xs text-muted-foreground">
            {c.formOpens > 0 ? `${c.lgfRate.toFixed(1)}%` : '—'}
          </td>
        </tr>
      ))}
    </>
  );
}

function CreativesSubTable({ creatives }: { creatives: LeadGenFormCreative[] }) {
  const aggregated = useMemo<AggregatedCreative[]>(() => {
    const map = new Map<string, AggregatedCreative>();
    for (const c of creatives) {
      const key = c.creativeName || c.creativeId;
      if (!map.has(key)) {
        map.set(key, {
          creativeName: c.creativeName || c.creativeId,
          impressions: 0, clicks: 0, spent: 0, leads: 0, formOpens: 0,
          ctr: 0, cpc: 0, cpl: 0, lgfRate: 0,
          status: c.status,
          instances: [],
        });
      }
      const agg = map.get(key)!;
      agg.impressions += c.impressions;
      agg.clicks += c.clicks;
      agg.spent += c.spent;
      agg.leads += c.leads;
      agg.formOpens += c.formOpens;
      if (c.status === 'ACTIVE') agg.status = 'ACTIVE';
      agg.instances.push(c);
    }
    for (const agg of map.values()) {
      agg.ctr = agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0;
      agg.cpc = agg.clicks > 0 ? agg.spent / agg.clicks : 0;
      agg.cpl = agg.leads > 0 ? agg.spent / agg.leads : 0;
      agg.lgfRate = agg.formOpens > 0 ? (agg.leads / agg.formOpens) * 100 : 0;
    }
    return Array.from(map.values()).sort((a, b) => b.leads - a.leads || b.impressions - a.impressions);
  }, [creatives]);

  return (
    <div className="border-l-2 border-primary/20 ml-4 bg-muted/10 py-3 px-5">
      <p className="text-[11px] font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
        <Activity className="h-3 w-3" />
        {aggregated.length} creative{aggregated.length !== 1 ? 's' : ''} — click to expand
      </p>
      <div className="overflow-x-auto rounded-md border border-border/40">
        <table className="w-full text-xs border-separate border-spacing-0 min-w-[860px]">
          <thead>
            <tr className="bg-muted/40">
              <th className="w-6 border-b border-border/60" />
              <th className="text-left p-2 font-semibold border-b border-border/60 text-muted-foreground min-w-[220px]">Creative Name</th>
              <th className="text-right p-2 font-semibold border-b border-border/60 text-muted-foreground">Impr.</th>
              <th className="text-right p-2 font-semibold border-b border-border/60 text-muted-foreground">Clicks</th>
              <th className="text-right p-2 font-semibold border-b border-border/60 text-muted-foreground">Spent</th>
              <th className="text-right p-2 font-semibold border-b border-border/60 text-muted-foreground">Leads</th>
              <th className="text-right p-2 font-semibold border-b border-border/60 text-muted-foreground">CTR</th>
              <th className="text-right p-2 font-semibold border-b border-border/60 text-muted-foreground">CPC</th>
              <th className="text-right p-2 font-semibold border-b border-border/60 text-muted-foreground">CPL</th>
              <th className="text-right p-2 font-semibold border-b border-border/60 text-muted-foreground">LGF Rate</th>
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

function FormRow({
  form,
  colCount,
  isSelected,
  onSelect,
}: {
  form: LeadGenFormData;
  colCount: number;
  isSelected?: boolean;
  onSelect?: (formUrn: string, formName: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const handleExportCreatives = (e: React.MouseEvent) => {
    e.stopPropagation();
    const columns = [
      { key: 'creativeName', label: 'Creative Name' },
      { key: 'creativeId', label: 'Creative ID' },
      { key: 'campaignName', label: 'Campaign Name' },
      { key: 'status', label: 'Status' },
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
        className={`group cursor-pointer transition-all duration-150 ${
          isOpen ? 'bg-muted/30' : 'hover:bg-muted/20'
        } ${isSelected ? 'bg-primary/8 ring-1 ring-inset ring-primary/20' : ''}`}
        onClick={() => {
          if (hasCreatives) setIsOpen(!isOpen);
          if (onSelect) onSelect(form.formUrn, form.formName);
        }}
      >
        <TableCell className="w-8 p-2 pl-3">
          {hasCreatives && (
            <span className="text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </span>
          )}
        </TableCell>
        <TableCell className="font-medium text-sm min-w-[160px]">
          <span className="text-foreground">{form.formName}</span>
        </TableCell>
        <TableCell className="text-right tabular-nums text-muted-foreground">{formatNumber(form.impressions)}</TableCell>
        <TableCell className="text-right tabular-nums text-muted-foreground">{formatNumber(form.clicks)}</TableCell>
        <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(form.spent)}</TableCell>
        <TableCell className="text-right tabular-nums font-bold text-primary">{formatNumber(form.leads)}</TableCell>
        <TableCell className="text-right tabular-nums text-muted-foreground">{formatNumber(form.formOpens)}</TableCell>
        <TableCell className="text-right tabular-nums text-muted-foreground">{form.ctr.toFixed(2)}%</TableCell>
        <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(form.cpc)}</TableCell>
        <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(form.cpl)}</TableCell>
        <TableCell className="text-right tabular-nums text-muted-foreground">
          {form.formOpens > 0 ? `${form.lgfRate.toFixed(1)}%` : '—'}
        </TableCell>
        <TableCell className="text-right">
          <Badge variant="outline" className="text-[10px] font-mono tabular-nums">{form.creatives.length}</Badge>
        </TableCell>
        <TableCell className="w-10 p-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleExportCreatives}
            title="Export creatives"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </TableCell>
      </TableRow>
      {isOpen && (
        <tr>
          <td colSpan={colCount} className="p-0 border-b border-border/30">
            <CreativesSubTable creatives={form.creatives} />
          </td>
        </tr>
      )}
    </>
  );
}

export function LeadGenFormsTable({ data, isLoading, selectedFormUrn, onSelectForm }: LeadGenFormsTableProps) {
  const { toast } = useToast();
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
      <div className="space-y-3">
        <div className="flex gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 flex-1 rounded-lg" />)}
        </div>
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-md" />)}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No lead gen forms found</p>
        <p className="text-sm mt-1">Try expanding your date range or check that creatives have lead gen forms attached.</p>
      </div>
    );
  }

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
    <div className="space-y-5">
      {/* Summary pills */}
      <div className="flex flex-wrap gap-2">
        <MetricPill label="Leads" value={formatNumber(summary.leads)} accent />
        <MetricPill label="Spent" value={formatCurrency(summary.spent)} />
        <MetricPill label="CPL" value={formatCurrency(summaryCpl)} />
        <MetricPill label="Impressions" value={formatNumber(summary.impressions)} />
        <MetricPill label="CTR" value={`${summaryCtr.toFixed(2)}%`} />
        <MetricPill label="LGF Rate" value={summaryLgfRate > 0 ? `${summaryLgfRate.toFixed(1)}%` : '—'} />
        <div className="ml-auto flex items-center">
          <Button variant="outline" size="sm" onClick={handleExportAll} className="h-8 text-xs gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Export All
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border/60 overflow-x-auto bg-card/30">
        <Table className="min-w-[1100px]">
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-8" />
              <TableHead className="min-w-[160px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Form Name</TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Impr.</TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Clicks</TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Spent</TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Leads</TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Opens</TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">CTR</TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">CPC</TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">CPL</TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">LGF Rate</TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ads</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((form) => (
              <FormRow
                key={form.formUrn}
                form={form}
                colCount={COL_COUNT}
                isSelected={selectedFormUrn === form.formUrn}
                onSelect={onSelectForm}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

import { useState } from 'react';
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

const COLS = 12; // total columns: expand + name + impressions + clicks + spent + leads + form-opens + ctr + cpc + cpl + lgf-rate + creatives + export = 13

function CreativesSubTable({ creatives }: { creatives: LeadGenFormCreative[] }) {
  return (
    <div className="bg-muted/30 py-3 px-6 mb-1">
      <p className="text-xs font-medium text-muted-foreground mb-2">
        Connected Creatives ({creatives.length})
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-separate border-spacing-0 min-w-[900px]">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left p-2 font-semibold border-b border-border min-w-[200px]">Creative</th>
              <th className="text-left p-2 font-semibold border-b border-border min-w-[160px]">Campaign</th>
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
            {creatives.map((creative) => (
              <tr key={creative.creativeId} className="hover:bg-muted/40 border-b border-border/40">
                <td className="p-2 font-medium">{creative.creativeName}</td>
                <td className="p-2 text-muted-foreground">{creative.campaignName || creative.campaignId || '—'}</td>
                <td className="p-2 text-right tabular-nums">{creative.impressions.toLocaleString()}</td>
                <td className="p-2 text-right tabular-nums">{creative.clicks.toLocaleString()}</td>
                <td className="p-2 text-right tabular-nums">${creative.spent.toFixed(2)}</td>
                <td className="p-2 text-right tabular-nums font-medium">{creative.leads}</td>
                <td className="p-2 text-right tabular-nums">{creative.ctr.toFixed(2)}%</td>
                <td className="p-2 text-right tabular-nums">${creative.cpc.toFixed(2)}</td>
                <td className="p-2 text-right tabular-nums">${creative.cpl.toFixed(2)}</td>
                <td className="p-2 text-right tabular-nums">
                  {creative.formOpens > 0 ? `${creative.lgfRate.toFixed(1)}%` : '—'}
                </td>
              </tr>
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
      {/* Sub-table row — plain <tr> with a single <td> spanning all columns */}
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

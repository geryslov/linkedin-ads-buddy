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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { exportToCSV } from '@/lib/exportUtils';
import { useToast } from '@/hooks/use-toast';

interface LeadGenFormsTableProps {
  data: LeadGenFormData[];
  isLoading: boolean;
}

function CreativesSubTable({ creatives }: { creatives: LeadGenFormCreative[] }) {
  return (
    <div className="bg-muted/30 p-4 rounded-lg ml-8 mr-4 mb-4">
      <h4 className="text-sm font-medium mb-3 text-muted-foreground">Connected Creatives ({creatives.length})</h4>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs">Creative</TableHead>
            <TableHead className="text-xs text-right">Impressions</TableHead>
            <TableHead className="text-xs text-right">Clicks</TableHead>
            <TableHead className="text-xs text-right">Spent</TableHead>
            <TableHead className="text-xs text-right">Leads</TableHead>
            <TableHead className="text-xs text-right">CTR</TableHead>
            <TableHead className="text-xs text-right">CPC</TableHead>
            <TableHead className="text-xs text-right">CPL</TableHead>
            <TableHead className="text-xs text-right">LGF Rate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {creatives.map((creative) => (
            <TableRow key={creative.creativeId} className="hover:bg-muted/50">
              <TableCell className="text-xs font-medium max-w-[200px] truncate" title={creative.creativeName}>
                {creative.creativeName}
              </TableCell>
              <TableCell className="text-xs text-right">{creative.impressions.toLocaleString()}</TableCell>
              <TableCell className="text-xs text-right">{creative.clicks.toLocaleString()}</TableCell>
              <TableCell className="text-xs text-right">${creative.spent.toFixed(2)}</TableCell>
              <TableCell className="text-xs text-right font-medium">{creative.leads}</TableCell>
              <TableCell className="text-xs text-right">{creative.ctr.toFixed(2)}%</TableCell>
              <TableCell className="text-xs text-right">${creative.cpc.toFixed(2)}</TableCell>
              <TableCell className="text-xs text-right">${creative.cpl.toFixed(2)}</TableCell>
              <TableCell className="text-xs text-right">
                {creative.formOpens > 0 ? `${creative.lgfRate.toFixed(1)}%` : '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function FormRow({ form }: { form: LeadGenFormData }) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const handleExportCreatives = () => {
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
    toast({
      title: 'Export successful',
      description: `${form.creatives.length} creatives exported`,
    });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <TableRow className="hover:bg-muted/50 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
        <TableCell className="w-8">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
        </TableCell>
        <TableCell className="font-medium max-w-[250px] truncate" title={form.formName}>
          {form.formName}
        </TableCell>
        <TableCell className="text-right">{form.impressions.toLocaleString()}</TableCell>
        <TableCell className="text-right">{form.clicks.toLocaleString()}</TableCell>
        <TableCell className="text-right">${form.spent.toFixed(2)}</TableCell>
        <TableCell className="text-right font-semibold text-primary">{form.leads}</TableCell>
        <TableCell className="text-right">{form.formOpens}</TableCell>
        <TableCell className="text-right">{form.ctr.toFixed(2)}%</TableCell>
        <TableCell className="text-right">${form.cpc.toFixed(2)}</TableCell>
        <TableCell className="text-right">${form.cpl.toFixed(2)}</TableCell>
        <TableCell className="text-right">
          {form.formOpens > 0 ? `${form.lgfRate.toFixed(1)}%` : '-'}
        </TableCell>
        <TableCell className="text-right text-muted-foreground">{form.creatives.length}</TableCell>
        <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
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
      <CollapsibleContent asChild>
        <tr>
          <td colSpan={13} className="p-0">
            <CreativesSubTable creatives={form.creatives} />
          </td>
        </tr>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function LeadGenFormsTable({ data, isLoading }: LeadGenFormsTableProps) {
  const { toast } = useToast();

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
    const exportData = data.map(form => ({
      ...form,
      creativesCount: form.creatives.length,
    }));
    exportToCSV(exportData, 'lead_gen_forms_report', columns);
    toast({
      title: 'Export successful',
      description: `${data.length} forms exported`,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
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

  // Calculate summary totals
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
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Form Name</TableHead>
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
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((form) => (
              <FormRow key={form.formUrn} form={form} />
            ))}
            {/* Summary Row */}
            <TableRow className="bg-muted/50 font-semibold border-t-2">
              <TableCell></TableCell>
              <TableCell>Summary ({data.length} forms)</TableCell>
              <TableCell className="text-right">{summary.impressions.toLocaleString()}</TableCell>
              <TableCell className="text-right">{summary.clicks.toLocaleString()}</TableCell>
              <TableCell className="text-right">${summary.spent.toFixed(2)}</TableCell>
              <TableCell className="text-right text-primary">{summary.leads}</TableCell>
              <TableCell className="text-right">{summary.formOpens}</TableCell>
              <TableCell className="text-right">{summaryCtr.toFixed(2)}%</TableCell>
              <TableCell className="text-right">${summaryCpc.toFixed(2)}</TableCell>
              <TableCell className="text-right">${summaryCpl.toFixed(2)}</TableCell>
              <TableCell className="text-right">
                {summary.formOpens > 0 ? `${summaryLgfRate.toFixed(1)}%` : '-'}
              </TableCell>
              <TableCell className="text-right">{summary.creatives}</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

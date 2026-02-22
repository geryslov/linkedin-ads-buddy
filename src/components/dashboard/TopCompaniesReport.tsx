import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CompanyDemographicItem } from '@/hooks/useCompanyDemographic';
import { CampaignSearchSelect } from './CampaignSearchSelect';
import { TimeFrameSelector } from './TimeFrameSelector';
import { MetricCard } from './MetricCard';
import {
  Eye, MousePointerClick, DollarSign, Ban, Loader2, Building2, Trophy, AlertCircle,
} from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  status: string;
}

interface TopCompaniesReportProps {
  companyData: CompanyDemographicItem[];
  isLoading: boolean;
  error: string | null;
  accessToken: string | null;
  selectedAccount: string | null;
  campaigns: Campaign[];
  timeFrameOptions: any[];
  selectedTimeFrame: string;
  onTimeFrameChange: (option: any) => void;
  dateRange: { start: string; end: string };
  onCustomDateChange: (start: Date, end: Date) => void;
  onRefresh: () => void;
}

type MetricType = 'impressions' | 'clicks' | 'spent';

interface CompanyForExclusion {
  entityUrn: string;
  entityName: string;
}

export function TopCompaniesReport({
  companyData,
  isLoading,
  error,
  accessToken,
  selectedAccount,
  campaigns,
  timeFrameOptions,
  selectedTimeFrame,
  onTimeFrameChange,
  dateRange,
  onCustomDateChange,
  onRefresh,
}: TopCompaniesReportProps) {
  const { toast } = useToast();
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [showExcludeDialog, setShowExcludeDialog] = useState(false);
  const [excludeCampaignIds, setExcludeCampaignIds] = useState<string[]>([]);
  const [excludeAllCampaigns, setExcludeAllCampaigns] = useState(false);
  const [isExcluding, setIsExcluding] = useState(false);

  const top3ByImpressions = useMemo(() =>
    [...companyData].sort((a, b) => b.impressions - a.impressions).slice(0, 3),
    [companyData]
  );

  const top3ByClicks = useMemo(() =>
    [...companyData].sort((a, b) => b.clicks - a.clicks).slice(0, 3),
    [companyData]
  );

  const top3BySpend = useMemo(() =>
    [...companyData].sort((a, b) => b.spent - a.spent).slice(0, 3),
    [companyData]
  );

  const toggleCompany = (entityUrn: string) => {
    setSelectedCompanies(prev => {
      const next = new Set(prev);
      if (next.has(entityUrn)) next.delete(entityUrn);
      else next.add(entityUrn);
      return next;
    });
  };

  const selectedCompanyDetails = useMemo(() => {
    return companyData.filter(c => selectedCompanies.has(c.entityUrn));
  }, [companyData, selectedCompanies]);

  const activeCampaigns = useMemo(() =>
    campaigns.filter(c => c.status === 'ACTIVE'),
    [campaigns]
  );

  const handleExclude = useCallback(async () => {
    if (!accessToken || !selectedAccount) return;

    const campaignIds = excludeAllCampaigns
      ? activeCampaigns.map(c => c.id)
      : excludeCampaignIds;

    if (campaignIds.length === 0) {
      toast({ title: 'No campaigns selected', description: 'Select at least one campaign to exclude from.', variant: 'destructive' });
      return;
    }

    const companyUrns = Array.from(selectedCompanies).map(entityUrn => {
      // entityUrn is like "urn:li:organization:12345" - we need "urn:li:adTargetingFacet:employers" value
      return entityUrn;
    });

    if (companyUrns.length === 0) return;

    setIsExcluding(true);

    try {
      const { data, error: fetchError } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'exclude_companies_from_campaigns',
          accessToken,
          params: {
            campaignIds,
            companyUrns,
          }
        }
      });

      if (fetchError) throw fetchError;

      const results = data?.results || [];
      const successCount = results.filter((r: any) => r.success).length;

      if (successCount === campaignIds.length) {
        toast({
          title: 'Companies Excluded',
          description: `Successfully excluded ${companyUrns.length} company(ies) from ${successCount} campaign(s).`,
        });
        setShowExcludeDialog(false);
        setSelectedCompanies(new Set());
        setExcludeCampaignIds([]);
        setExcludeAllCampaigns(false);
      } else {
        const failedCount = campaignIds.length - successCount;
        toast({
          title: 'Partial Success',
          description: `${successCount}/${campaignIds.length} campaigns updated. ${failedCount} failed.`,
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Exclusion Failed',
        description: err.message || 'Failed to exclude companies',
        variant: 'destructive',
      });
    } finally {
      setIsExcluding(false);
    }
  }, [accessToken, selectedAccount, selectedCompanies, excludeCampaignIds, excludeAllCampaigns, activeCampaigns, toast]);

  const renderTopCard = (title: string, icon: React.ElementType, metric: MetricType, items: CompanyDemographicItem[], color: string) => (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className={`h-4 w-4 ${color}`} />
          {title}
        </CardTitle>
        <CardDescription>Top 3 companies by {metric}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No data available</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10" />
                <TableHead className="w-8 text-center">#</TableHead>
                <TableHead>Company</TableHead>
                <TableHead className="text-right">{metric === 'spent' ? 'Spend' : metric.charAt(0).toUpperCase() + metric.slice(1)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, idx) => (
                <TableRow key={item.entityUrn} className="hover:bg-muted/20">
                  <TableCell>
                    <Checkbox
                      checked={selectedCompanies.has(item.entityUrn)}
                      onCheckedChange={() => toggleCompany(item.entityUrn)}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={idx === 0 ? 'default' : 'secondary'} className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs">
                      {idx + 1}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium max-w-[180px] truncate" title={item.entityName}>
                    {item.entityName}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {metric === 'spent'
                      ? `$${item.spent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : item[metric].toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Time Frame */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="pt-4">
          <TimeFrameSelector
            timeFrameOptions={timeFrameOptions}
            selectedTimeFrame={selectedTimeFrame}
            onTimeFrameChange={onTimeFrameChange}
            timeGranularity="ALL"
            onGranularityChange={() => {}}
            dateRange={dateRange}
            onCustomDateChange={onCustomDateChange}
          />
        </CardContent>
      </Card>

      {error && (
        <Card className="bg-destructive/10 border-destructive/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top 3 Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {renderTopCard('Highest Impressions', Eye, 'impressions', top3ByImpressions, 'text-blue-500')}
        {renderTopCard('Most Clicks', MousePointerClick, 'clicks', top3ByClicks, 'text-green-500')}
        {renderTopCard('Highest Spend', DollarSign, 'spent', top3BySpend, 'text-amber-500')}
      </div>

      {/* Exclude Action */}
      {selectedCompanies.size > 0 && (
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Ban className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium">{selectedCompanies.size} company(ies) selected</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedCompanyDetails.map(c => c.entityName).join(', ')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedCompanies(new Set())}>
                  Clear
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowExcludeDialog(true)}
                >
                  <Ban className="h-4 w-4 mr-2" />
                  Exclude from Campaigns
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Exclude Dialog */}
      <Dialog open={showExcludeDialog} onOpenChange={setShowExcludeDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-destructive" />
              Exclude Companies from Campaigns
            </DialogTitle>
            <DialogDescription>
              This will add the selected companies to the campaign targeting exclusion list on LinkedIn.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Selected Companies */}
            <div>
              <p className="text-sm font-medium mb-2">Companies to exclude:</p>
              <div className="flex flex-wrap gap-2">
                {selectedCompanyDetails.map(c => (
                  <Badge key={c.entityUrn} variant="secondary" className="gap-1">
                    <Building2 className="h-3 w-3" />
                    {c.entityName}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Campaign Selection */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="exclude-all"
                  checked={excludeAllCampaigns}
                  onCheckedChange={(checked) => {
                    setExcludeAllCampaigns(checked === true);
                    if (checked) setExcludeCampaignIds([]);
                  }}
                />
                <label htmlFor="exclude-all" className="text-sm font-medium cursor-pointer">
                  Exclude from all active campaigns ({activeCampaigns.length})
                </label>
              </div>

              {!excludeAllCampaigns && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Or select specific campaigns:</p>
                  <CampaignSearchSelect
                    campaigns={campaigns}
                    selectedCampaignIds={excludeCampaignIds}
                    onChange={setExcludeCampaignIds}
                  />
                </div>
              )}
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-3">
              <p className="text-sm text-amber-700 dark:text-amber-300">
                <strong>Note:</strong> This will modify your LinkedIn campaign targeting. Companies will be added to the exclusion list and won't see your ads.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowExcludeDialog(false)} disabled={isExcluding}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleExclude}
              disabled={isExcluding || (!excludeAllCampaigns && excludeCampaignIds.length === 0)}
            >
              {isExcluding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluding...
                </>
              ) : (
                <>
                  <Ban className="h-4 w-4 mr-2" />
                  Confirm Exclusion
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useActivities, Activity } from '@/hooks/useActivities';
import { useCampaignPerformanceReport, PeriodMetrics } from '@/hooks/useCampaignPerformanceReport';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { WidgetCard, EmptyState, StatusPill } from './widgets';
import { MetricCard } from './MetricCard';
import {
  Plus, Pencil, Trash2, Search, Eye, MousePointerClick, DollarSign, Target,
  ChevronDown, ChevronRight, FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  accessToken: string | null;
  selectedAccount: string | null;
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'info' | 'neutral'> = {
  ACTIVE: 'success',
  PAUSED: 'warning',
  DRAFT: 'info',
};

export function ActivityReport({ accessToken, selectedAccount }: Props) {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { activities, isLoading: activitiesLoading, fetchActivities, createActivity, updateActivity, deleteActivity } = useActivities(
    selectedAccount,
    user?.id ?? null,
  );
  const { data: allCampaigns, isLoading: campaignsLoading, fetchReport } = useCampaignPerformanceReport(accessToken);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [activityName, setActivityName] = useState('');
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [campaignSearch, setCampaignSearch] = useState('');
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  useEffect(() => {
    if (selectedAccount && accessToken) {
      fetchReport(selectedAccount);
    }
  }, [selectedAccount, accessToken, fetchReport]);

  const filteredCampaigns = useMemo(() => {
    if (!campaignSearch) return allCampaigns;
    const q = campaignSearch.toLowerCase();
    return allCampaigns.filter(c => c.campaignName.toLowerCase().includes(q) || c.campaignId.includes(q));
  }, [allCampaigns, campaignSearch]);

  const openCreateDialog = () => {
    if (!isAuthenticated || authLoading) return;
    setEditingActivity(null);
    setActivityName('');
    setSelectedCampaigns([]);
    setCampaignSearch('');
    setDialogOpen(true);
  };

  const openEditDialog = (activity: Activity) => {
    setEditingActivity(activity);
    setActivityName(activity.name);
    setSelectedCampaigns(activity.campaign_ids);
    setCampaignSearch('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (authLoading || !isAuthenticated || !activityName.trim() || selectedCampaigns.length === 0) return;

    const success = editingActivity
      ? await updateActivity(editingActivity.id, activityName.trim(), selectedCampaigns)
      : await createActivity(activityName.trim(), selectedCampaigns);

    if (success) setDialogOpen(false);
  };

  const toggleCampaign = (id: string) => {
    setSelectedCampaigns(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const getActivityMetrics = useCallback((activity: Activity) => {
    const matched = allCampaigns.filter(c => activity.campaign_ids.includes(c.campaignId));
    const aggregate = (field: 'last7d' | 'last14d' | 'last30d' | 'lastMonth') => {
      return matched.reduce((acc, c) => {
        const p = c[field];
        return {
          impressions: acc.impressions + p.impressions,
          clicks: acc.clicks + p.clicks,
          spent: acc.spent + p.spent,
          leads: acc.leads + p.leads,
          ctr: 0,
          cpl: 0,
        };
      }, { impressions: 0, clicks: 0, spent: 0, leads: 0, ctr: 0, cpl: 0 } as PeriodMetrics);
    };

    const m = aggregate('last7d');
    m.ctr = m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0;
    m.cpl = m.leads > 0 ? m.spent / m.leads : 0;
    return { metrics: m, campaigns: matched };
  }, [allCampaigns]);

  if (activitiesLoading && activities.length === 0) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            Group campaigns into activities to track their combined performance.
          </p>
          {!authLoading && !isAuthenticated && (
            <p className="text-sm text-primary">
              Sign in with your app account at <a href="/auth?mode=email" className="font-medium underline underline-offset-4">/auth</a> to save activities permanently.
            </p>
          )}
        </div>
        <Button onClick={openCreateDialog} className="gap-2" disabled={authLoading || !isAuthenticated}>
          <Plus className="h-4 w-4" /> Add Activity
        </Button>
      </div>

      {activities.length === 0 ? (
        <WidgetCard noPadding>
          <EmptyState
            icon={FolderOpen}
            title="No activities yet"
            description="Create one to start tracking grouped campaign performance."
            action={
              <Button onClick={openCreateDialog} size="sm" className="gap-2" disabled={authLoading || !isAuthenticated}>
                <Plus className="h-4 w-4" /> Add Activity
              </Button>
            }
          />
        </WidgetCard>
      ) : (
        <div className="space-y-4">
          {activities.map(activity => {
            const { metrics, campaigns } = getActivityMetrics(activity);
            const isExpanded = expandedActivity === activity.id;

            return (
              <WidgetCard
                key={activity.id}
                noPadding
                title={
                  <button
                    onClick={() => setExpandedActivity(isExpanded ? null : activity.id)}
                    className="flex items-center gap-2 hover:text-primary transition-colors"
                  >
                    {isExpanded
                      ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                    {activity.name}
                  </button>
                }
                subtitle={`${activity.campaign_ids.length} campaign${activity.campaign_ids.length !== 1 ? 's' : ''} · last 7 days`}
                toolbar={
                  <>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(activity)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteActivity(activity.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                }
              >
                <div className={cn('px-5', isExpanded ? 'pb-3' : 'pb-5')}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MetricCard title="Impressions" value={metrics.impressions.toLocaleString()} icon={Eye} delay={0} />
                    <MetricCard title="Clicks" value={metrics.clicks.toLocaleString()} icon={MousePointerClick} delay={50} />
                    <MetricCard title="Spend" value={`$${metrics.spent.toFixed(2)}`} icon={DollarSign} delay={100} />
                    <MetricCard title="Leads" value={metrics.leads.toLocaleString()} icon={Target} delay={150} />
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border/60">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent bg-secondary/40">
                          <TableHead>Campaign</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Impressions</TableHead>
                          <TableHead className="text-right">Clicks</TableHead>
                          <TableHead className="text-right">CTR</TableHead>
                          <TableHead className="text-right">Spend</TableHead>
                          <TableHead className="text-right">Leads</TableHead>
                          <TableHead className="text-right">CPL</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {campaigns.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                              No matching campaign data found
                            </TableCell>
                          </TableRow>
                        ) : campaigns.map(c => (
                          <TableRow key={c.campaignId} className="[&>td]:py-2.5">
                            <TableCell className="font-medium max-w-[240px]">
                              <span className="block truncate" title={c.campaignName}>{c.campaignName}</span>
                            </TableCell>
                            <TableCell>
                              <StatusPill
                                tone={STATUS_TONE[c.campaignStatus] ?? 'neutral'}
                                label={c.campaignStatus.charAt(0) + c.campaignStatus.slice(1).toLowerCase()}
                              />
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{c.last7d.impressions.toLocaleString()}</TableCell>
                            <TableCell className="text-right tabular-nums">{c.last7d.clicks.toLocaleString()}</TableCell>
                            <TableCell className="text-right tabular-nums">{c.last7d.ctr.toFixed(2)}%</TableCell>
                            <TableCell className="text-right tabular-nums">${c.last7d.spent.toFixed(2)}</TableCell>
                            <TableCell className="text-right tabular-nums">{c.last7d.leads.toLocaleString()}</TableCell>
                            <TableCell className="text-right tabular-nums">{c.last7d.cpl > 0 ? `$${c.last7d.cpl.toFixed(2)}` : '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </WidgetCard>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingActivity ? 'Edit Activity' : 'Create Activity'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Activity Name</label>
              <Input
                placeholder="e.g. Q1 Brand Awareness Push"
                value={activityName}
                onChange={e => setActivityName(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Select Campaigns ({selectedCampaigns.length} selected)
              </label>
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search campaigns..."
                  className="pl-8 h-8 text-sm"
                  value={campaignSearch}
                  onChange={e => setCampaignSearch(e.target.value)}
                />
              </div>

              {campaignsLoading ? (
                <Skeleton className="h-48 rounded-lg" />
              ) : (
                <ScrollArea className="h-64 border rounded-lg">
                  <div className="p-2 space-y-1">
                    {filteredCampaigns.map(c => (
                      <label
                        key={c.campaignId}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer hover:bg-secondary/40 transition-colors',
                          selectedCampaigns.includes(c.campaignId) && 'bg-primary/5'
                        )}
                      >
                        <Checkbox
                          checked={selectedCampaigns.includes(c.campaignId)}
                          onCheckedChange={() => toggleCampaign(c.campaignId)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{c.campaignName}</p>
                          <p className="text-xs text-muted-foreground">{c.campaignStatus} · {c.objectiveType}</p>
                        </div>
                      </label>
                    ))}
                    {filteredCampaigns.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-6">No campaigns found</p>
                    )}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={authLoading || !isAuthenticated || !activityName.trim() || selectedCampaigns.length === 0}>
              {editingActivity ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

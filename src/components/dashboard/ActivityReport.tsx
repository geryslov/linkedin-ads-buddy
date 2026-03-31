import { useEffect, useState, useMemo, useCallback } from 'react';
import { useActivities, Activity } from '@/hooks/useActivities';
import { useCampaignPerformanceReport, PeriodMetrics } from '@/hooks/useCampaignPerformanceReport';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
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
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No activities yet. Create one to start tracking grouped campaign performance.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {activities.map(activity => {
            const { metrics, campaigns } = getActivityMetrics(activity);
            const isExpanded = expandedActivity === activity.id;

            return (
              <Card key={activity.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpandedActivity(isExpanded ? null : activity.id)}>
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      <div>
                        <CardTitle className="text-base">{activity.name}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {activity.campaign_ids.length} campaign{activity.campaign_ids.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(activity)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteActivity(activity.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <MetricCard title="Impressions" value={metrics.impressions.toLocaleString()} icon={Eye} delay={0} />
                    <MetricCard title="Clicks" value={metrics.clicks.toLocaleString()} icon={MousePointerClick} delay={50} />
                    <MetricCard title="Spend" value={`$${metrics.spent.toFixed(2)}`} icon={DollarSign} delay={100} />
                    <MetricCard title="Leads" value={metrics.leads.toLocaleString()} icon={Target} delay={150} />
                  </div>

                  {isExpanded && (
                    <div className="mt-4 border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50 border-b">
                            <th className="text-left px-3 py-2 font-medium">Campaign</th>
                            <th className="text-left px-3 py-2 font-medium">Status</th>
                            <th className="text-right px-3 py-2 font-medium">Impressions</th>
                            <th className="text-right px-3 py-2 font-medium">Clicks</th>
                            <th className="text-right px-3 py-2 font-medium">CTR</th>
                            <th className="text-right px-3 py-2 font-medium">Spend</th>
                            <th className="text-right px-3 py-2 font-medium">Leads</th>
                            <th className="text-right px-3 py-2 font-medium">CPL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {campaigns.length === 0 ? (
                            <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">No matching campaign data found</td></tr>
                          ) : campaigns.map(c => (
                            <tr key={c.campaignId} className="border-b last:border-0 hover:bg-muted/30">
                              <td className="px-3 py-2 font-medium max-w-[200px] truncate">{c.campaignName}</td>
                              <td className="px-3 py-2">
                                <Badge variant={c.campaignStatus === 'ACTIVE' ? 'default' : 'secondary'} className="text-xs">
                                  {c.campaignStatus}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">{c.last7d.impressions.toLocaleString()}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{c.last7d.clicks.toLocaleString()}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{c.last7d.ctr.toFixed(2)}%</td>
                              <td className="px-3 py-2 text-right tabular-nums">${c.last7d.spent.toFixed(2)}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{c.last7d.leads.toLocaleString()}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{c.last7d.cpl > 0 ? `$${c.last7d.cpl.toFixed(2)}` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
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
                          'flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors',
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

import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAIAnalysis } from '@/hooks/useAIAnalysis';
import type { WeeklyReportData } from '@/hooks/useWeeklyReport';
import { extractKpiSnapshot, serializeReportForClaude, type KpiSnapshot } from '@/lib/serializeReportForClaude';
import { Sparkles, Copy, Check, ExternalLink, Loader2, Trash2, Share2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: WeeklyReportData;
  accountId: string;
  fallbackAccountName?: string;
}

interface PublishedRow {
  id: string;
  share_token: string;
  account_id: string;
  client_name: string;
  week_start: string;
  week_end: string;
  published_at: string;
  revoked_at: string | null;
}

type Step = 'preview' | 'streaming' | 'edit' | 'published';

export function GenerateClientReportDialog({ open, onOpenChange, data, accountId, fallbackAccountName }: Props) {
  const [clientName, setClientName] = useState(fallbackAccountName || '');
  const [step, setStep] = useState<Step>('preview');
  const [narrative, setNarrative] = useState('');
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pastReports, setPastReports] = useState<PublishedRow[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const { toast } = useToast();
  const ai = useAIAnalysis();

  const kpiSnapshot: KpiSnapshot = useMemo(() => extractKpiSnapshot(data), [data]);
  const claudePayload = useMemo(() => serializeReportForClaude(data), [data]);

  // Pre-fill name from linkedin_ad_accounts when the account changes
  useEffect(() => {
    if (!open || !accountId) return;
    (async () => {
      const { data: acct } = await supabase
        .from('linkedin_ad_accounts')
        .select('name')
        .eq('account_id', accountId)
        .maybeSingle();
      if (acct?.name && !clientName) setClientName(acct.name);
      else if (!clientName && fallbackAccountName) setClientName(fallbackAccountName);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accountId]);

  // Sync AI streamed text into local editable narrative
  useEffect(() => {
    const latest = ai.messages.filter(m => m.role === 'assistant').pop();
    if (latest?.content) {
      setNarrative(latest.content);
      if (step === 'streaming' && !ai.isLoading) setStep('edit');
    }
  }, [ai.messages, ai.isLoading, step]);

  const loadPastReports = async () => {
    setIsLoadingList(true);
    const { data: resp, error } = await supabase.functions.invoke('linkedin-api', {
      body: { action: 'list_published_reports', params: { accountId } },
    });
    setIsLoadingList(false);
    if (error || resp?.error) {
      toast({ title: 'Failed to load past reports', description: resp?.error || String(error), variant: 'destructive' });
      return;
    }
    setPastReports(resp?.reports || []);
  };

  const handleGenerate = () => {
    ai.clearHistory();
    setNarrative('');
    setStep('streaming');
    ai.ask(
      "Write this client's weekly LinkedIn ads report following the exact structure in your instructions.",
      claudePayload,
      'client_weekly_report',
    );
  };

  const handlePublish = async () => {
    if (!narrative.trim() || !clientName.trim()) {
      toast({ title: 'Missing fields', description: 'Client name and report content are required.', variant: 'destructive' });
      return;
    }
    setIsPublishing(true);
    const { data: resp, error } = await supabase.functions.invoke('linkedin-api', {
      body: {
        action: 'publish_weekly_report',
        params: {
          accountId,
          clientName: clientName.trim(),
          weekStart: kpiSnapshot.weekStart,
          weekEnd: kpiSnapshot.weekEnd,
          narrativeMarkdown: narrative,
          kpiSnapshot,
          rawData: claudePayload,
        },
      },
    });
    setIsPublishing(false);
    if (error || resp?.error) {
      toast({ title: 'Publish failed', description: resp?.error || String(error), variant: 'destructive' });
      return;
    }
    // publicUrl from edge function uses origin header; prefer window.location.origin to be safe
    const url = `${window.location.origin}/report/${resp.shareToken}`;
    setPublishedUrl(url);
    setStep('published');
  };

  const handleRevoke = async (reportId: string) => {
    const { data: resp, error } = await supabase.functions.invoke('linkedin-api', {
      body: { action: 'revoke_published_report', params: { reportId } },
    });
    if (error || resp?.error) {
      toast({ title: 'Revoke failed', description: resp?.error || String(error), variant: 'destructive' });
      return;
    }
    toast({ title: 'Report revoked' });
    loadPastReports();
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    setStep('preview');
    setNarrative('');
    setPublishedUrl(null);
    ai.clearHistory();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogTitle className="flex items-center gap-2">
          <Share2 className="h-4 w-4" />
          Publish weekly report for client
        </DialogTitle>
        <DialogDescription>
          Generate a client-ready narrative with Claude, edit if needed, then publish a shareable link.
        </DialogDescription>

        <Tabs defaultValue="new" className="flex-1 overflow-hidden flex flex-col" onValueChange={(v) => { if (v === 'past') loadPastReports(); }}>
          <TabsList className="w-fit">
            <TabsTrigger value="new">New report</TabsTrigger>
            <TabsTrigger value="past">Past reports</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="flex-1 overflow-auto space-y-4 mt-4">
            {step === 'preview' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Client name (shown at top of report)</label>
                  <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Acme Corp" />
                </div>

                <div className="p-4 rounded-lg border border-border/70 bg-muted/30 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Week snapshot</p>
                  <p className="text-sm">
                    <strong>{kpiSnapshot.weekStart}</strong> to <strong>{kpiSnapshot.weekEnd}</strong>
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>Spent: <strong>${kpiSnapshot.thisWeek.spent.toFixed(0)}</strong></div>
                    <div>Leads: <strong>{kpiSnapshot.thisWeek.leads}</strong></div>
                    <div>CPL: <strong>${kpiSnapshot.thisWeek.cpl.toFixed(2)}</strong></div>
                    <div>Impressions: <strong>{kpiSnapshot.thisWeek.impressions.toLocaleString()}</strong></div>
                    <div>Clicks: <strong>{kpiSnapshot.thisWeek.clicks.toLocaleString()}</strong></div>
                    <div>CTR: <strong>{kpiSnapshot.thisWeek.ctr.toFixed(2)}%</strong></div>
                  </div>
                </div>

                <Button onClick={handleGenerate} disabled={!clientName.trim()} className="w-full gap-2">
                  <Sparkles className="h-4 w-4" />
                  Generate with Claude
                </Button>
              </div>
            )}

            {(step === 'streaming' || step === 'edit') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {step === 'streaming' ? 'Streaming…' : 'Edit before publishing'}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleGenerate} disabled={ai.isLoading}>
                      <Sparkles className="h-3 w-3 mr-1" /> Regenerate
                    </Button>
                    <Button size="sm" onClick={handlePublish} disabled={ai.isLoading || isPublishing || !narrative.trim()}>
                      {isPublishing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Share2 className="h-3 w-3 mr-1" />}
                      Publish
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <Textarea
                    value={narrative}
                    onChange={(e) => setNarrative(e.target.value)}
                    placeholder="Report will stream in here…"
                    className="min-h-[400px] font-mono text-xs"
                  />
                  <div className="min-h-[400px] max-h-[500px] overflow-auto rounded-md border border-border/70 bg-card p-4 prose prose-sm dark:prose-invert max-w-none
                    [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-1.5
                    [&_p]:text-sm [&_li]:text-sm">
                    <ReactMarkdown>{narrative || '_Preview will appear here._'}</ReactMarkdown>
                  </div>
                </div>
                {ai.error && <p className="text-xs text-destructive">{ai.error}</p>}
              </div>
            )}

            {step === 'published' && publishedUrl && (
              <div className="space-y-4 py-4">
                <div className="text-center space-y-2">
                  <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 mx-auto flex items-center justify-center">
                    <Check className="h-5 w-5 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold">Report published</h3>
                  <p className="text-sm text-muted-foreground">Send this link to your client. It works without login.</p>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg border border-border/70 bg-muted/30">
                  <code className="flex-1 text-xs break-all">{publishedUrl}</code>
                  <Button size="sm" onClick={() => handleCopy(publishedUrl)} className="gap-1.5 shrink-0">
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <div className="flex justify-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={publishedUrl} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                      <ExternalLink className="h-3 w-3" /> View as client
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" onClick={reset}>Publish another</Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="flex-1 overflow-auto mt-4">
            {isLoadingList ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-4 w-4 animate-spin" /></div>
            ) : pastReports.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No published reports yet for this account.</p>
            ) : (
              <div className="space-y-2">
                {pastReports.map(r => {
                  const url = `${window.location.origin}/report/${r.share_token}`;
                  const isRevoked = !!r.revoked_at;
                  return (
                    <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/70 bg-card">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{r.client_name}</p>
                          {isRevoked && <Badge variant="destructive" className="text-[10px]">Revoked</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {r.week_start} — {r.week_end} · published {new Date(r.published_at).toLocaleDateString()}
                        </p>
                      </div>
                      {!isRevoked && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleCopy(url)} className="gap-1.5">
                            <Copy className="h-3 w-3" /> Copy
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleRevoke(r.id)} className="gap-1.5 text-destructive hover:text-destructive">
                            <Trash2 className="h-3 w-3" /> Revoke
                          </Button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

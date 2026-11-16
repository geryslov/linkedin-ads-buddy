import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusPill } from '@/components/dashboard/widgets';
import { useCompanyAudience } from '@/hooks/useCompanyAudience';
import type { CompanyIntelligence } from '@/hooks/useCompanyIntelligence';
import { AlertTriangle, CheckCircle2, Download, Loader2, RefreshCw, Users } from 'lucide-react';

// LinkedIn's company list template (create-and-manage-list-uploads): header names are matched literally.
const csvCell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const domain = (url: string) => url.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0];
const RECOMMENDED = 1000;

function downloadCompanyList(companies: CompanyIntelligence[], filename: string) {
  const rows = companies.map((c) => [c.companyName, domain(c.companyWebsite).slice(0, 100), c.companyPageUrl.length <= 100 ? c.companyPageUrl : '']);
  const csv = ['companyname,companywebsite,linkedincompanypageurl', ...rows.map((r) => r.map(csvCell).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

const STATUS_HELP: Record<string, string> = {
  no_permission: 'LinkedIn refused. Your LinkedIn user needs Account Manager or Campaign Manager on this ad account. Meanwhile, download the list and upload it in Campaign Manager → Plan → Audiences.',
  token_invalid: 'Log out and reconnect LinkedIn.',
  rate_limited: 'LinkedIn is throttling requests. Wait a minute and try again.',
  stale_deploy: 'Deploy linkedin-api (see CLAUDE.md → Deployment matrix).',
};

/** Turn a momentum list into a LinkedIn company matched audience: CSV download or direct creation. */
export function CompanyAudienceActions({ accessToken, accountId, companies, defaultName, filename }: {
  accessToken: string | null;
  accountId: string;
  companies: CompanyIntelligence[];
  defaultName: string;
  filename: string;
}) {
  const { created, creating, error, create, refresh, clearError } = useCompanyAudience(accessToken);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const mine = created.filter((a) => a.accountId === accountId);

  const openDialog = () => { setName(defaultName); clearError(); setOpen(true); };
  const submit = async () => {
    const a = await create(accountId, name.trim(), companies.map((c) => ({ name: c.companyName, website: c.companyWebsite, pageUrl: c.companyPageUrl })));
    if (a) setOpen(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Use these {companies.length.toLocaleString()} companies as a LinkedIn audience:</span>
        <Button variant="outline" size="sm" className="h-7" disabled={!companies.length} onClick={() => downloadCompanyList(companies, filename)}>
          <Download className="h-3.5 w-3.5" /><span className="ml-1.5">Download for LinkedIn</span>
        </Button>
        <Button size="sm" className="h-7" disabled={!companies.length || !accessToken} onClick={openDialog}>
          <Users className="h-3.5 w-3.5" /><span className="ml-1.5">Create audience</span>
        </Button>
      </div>

      {mine.length > 0 && (
        <div className="rounded-lg border border-border/60 divide-y divide-border/40 text-xs">
          {mine.map((a) => {
            const s = a.status;
            return (
              <div key={a.segmentId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                <span className="font-medium">{a.name}</span>
                <span className="text-muted-foreground">{a.companies.toLocaleString()} companies uploaded{a.skipped ? ` · ${a.skipped} without a name, website or page skipped` : ''}</span>
                {s && s !== 'loading' && 'status' in s && (
                  <>
                    <StatusPill tone={s.status === 'READY' ? 'success' : s.status === 'FAILED' ? 'danger' : 'info'} label={s.status.toLowerCase()} />
                    {s.matchedCount !== null && <span className="text-muted-foreground">{s.matchedCount.toLocaleString()} matched</span>}
                    {s.audienceSize !== null && <span className="text-muted-foreground">{s.audienceSize.toLocaleString()} members</span>}
                  </>
                )}
                {s && s !== 'loading' && 'message' in s && <span className="text-destructive">{s.message}</span>}
                <button className="ml-auto flex items-center gap-1 text-primary hover:underline" onClick={() => refresh(a.segmentId)} disabled={s === 'loading'}>
                  {s === 'loading' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}Check status
                </button>
              </div>
            );
          })}
          <p className="px-3 py-2 text-[11px] text-muted-foreground">
            LinkedIn takes up to 48 hours to match a list. The audience is in Campaign Manager → Plan → Audiences, and isn't attached to any campaign.
          </p>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>Create a LinkedIn company audience</DialogTitle>
          <DialogDescription>
            Uploads these {companies.length.toLocaleString()} companies as a matched audience in this ad account. It isn't added to any campaign. You choose where to use it in Campaign Manager.
          </DialogDescription>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Audience name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
            </div>
            {companies.length < RECOMMENDED && (
              <p className="text-xs text-muted-foreground flex gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-px" />
                LinkedIn recommends at least {RECOMMENDED.toLocaleString()} companies. A smaller list may match too few members to serve ads on its own; check its size in Campaign Manager once it's matched.
              </p>
            )}
            {error && (
              <div className="text-xs">
                <p className="text-destructive font-medium">{error.message}</p>
                {STATUS_HELP[error.kind] && <p className="text-muted-foreground mt-0.5">{STATUS_HELP[error.kind]}</p>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={creating || !name.trim()}>
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
              <span className="ml-1.5">{creating ? 'Creating… (about 10 s)' : 'Create audience'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

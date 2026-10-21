import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useProspectFinder,
  AudienceRow,
  MoltSetsBudget,
  Prospect,
} from '@/hooks/useProspectFinder';
import { WidgetCard, EmptyState, StatusPill } from '@/components/dashboard/widgets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { exportToCSV } from '@/lib/exportUtils';
import { cn } from '@/lib/utils';
import {
  Building2,
  BriefcaseBusiness,
  Users,
  Search,
  Download,
  Loader2,
  ExternalLink,
  Info,
  ChevronDown,
  AlertTriangle,
  Radar,
} from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  status: string;
}

interface ProspectFinderProps {
  accessToken: string | null;
  selectedAccount: string | null;
  campaigns: Campaign[];
}

const DATE_RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

// MoltSets' seniority enum. Only these values are accepted.
const SENIORITY_OPTIONS = [
  'Intern', 'Entry', 'Senior', 'Manager', 'Director', 'VP', 'Head', 'C Suite', 'Owner', 'Partner',
];

function rangeToDates(days: string): { start: string; end: string } {
  const end = new Date();
  const start = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);
  return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
}

function fmtNum(n: number): string {
  return n.toLocaleString();
}

function locationOf(p: Prospect): string {
  return [p.city, p.state, p.country].filter(Boolean).join(', ') || '—';
}

const PER_COMPANY_CHOICES = [5, 10, 25];

/** The remaining-rows figure, whichever budget the plan reports it under.
 *  A trial plan counts returned rows; a paid plan counts records per window. */
function rowsRemaining(b: MoltSetsBudget | null | undefined): number | null {
  if (!b) return null;
  return b.searchResultsRemaining ?? b.recordsRemaining5h ?? null;
}

/** Selectable list of demographic rows — one panel for companies, one for job titles. */
function AudiencePanel({
  title,
  subtitle,
  icon: Icon,
  rows,
  selected,
  onToggle,
  onSelectTop,
  onClear,
  isLoading,
  emptyLabel,
}: {
  title: string;
  subtitle: string;
  icon: typeof Building2;
  rows: AudienceRow[];
  selected: Set<string>;
  onToggle: (urn: string) => void;
  onSelectTop: (n: number) => void;
  onClear: () => void;
  isLoading: boolean;
  emptyLabel: string;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => r.entityName.toLowerCase().includes(q));
  }, [rows, query]);

  return (
    <WidgetCard
      title={
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary/70" />
          {title}
          {selected.size > 0 && (
            <Badge variant="secondary" className="text-[11px]">{selected.size} selected</Badge>
          )}
        </span>
      }
      subtitle={subtitle}
      toolbar={
        rows.length > 0 ? (
          <>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => onSelectTop(10)}>
              Top 10
            </Button>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={onClear}>
              Clear
            </Button>
          </>
        ) : undefined
      }
      noPadding
    >
      {isLoading ? (
        <div className="py-14 flex items-center justify-center text-sm text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading demographics…
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Icon} title={emptyLabel} description="Pick campaigns above and load the audience." />
      ) : (
        <>
          <div className="px-5 pb-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={`Filter ${rows.length} rows…`}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
          <ScrollArea className="h-[320px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card border-y border-border/70">
                <tr className="text-muted-foreground">
                  <th className="w-8 px-3 py-2" />
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-right font-medium">Impr.</th>
                  <th className="px-3 py-2 text-right font-medium">Clicks</th>
                  <th className="px-3 py-2 text-right font-medium">CTR</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => {
                  const isSelected = selected.has(row.entityUrn);
                  return (
                    <tr
                      key={row.entityUrn}
                      className={cn(
                        'border-b border-border/40 cursor-pointer hover:bg-muted/40',
                        isSelected && 'bg-primary/[0.04]',
                      )}
                      onClick={() => onToggle(row.entityUrn)}
                    >
                      <td className="px-3 py-2">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => onToggle(row.entityUrn)}
                          onClick={e => e.stopPropagation()}
                          aria-label={`Select ${row.entityName}`}
                        />
                      </td>
                      <td className="px-3 py-2 font-medium text-foreground truncate max-w-[220px]">
                        {row.entityName}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.impressions)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.clicks)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {row.ctr.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      Nothing matches “{query}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </>
      )}
    </WidgetCard>
  );
}

export function ProspectFinder({ accessToken, selectedAccount, campaigns }: ProspectFinderProps) {
  const {
    companies, titles, isLoadingAudience, audienceError, loadAudience,
    prospects, companyResults, runMeta, isFinding, findError, findProspects,
    status, checkStatus, hasSession,
  } = useProspectFinder(accessToken);

  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [rangeDays, setRangeDays] = useState('30');
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [selectedTitles, setSelectedTitles] = useState<Set<string>>(new Set());
  const [seniority, setSeniority] = useState<string[]>([]);
  const [country, setCountry] = useState('');
  const [perCompanyLimit, setPerCompanyLimit] = useState('10');

  // A different account or campaign set makes the old selection meaningless.
  useEffect(() => {
    setSelectedCompanies(new Set());
    setSelectedTitles(new Set());
  }, [selectedAccount]);

  const toggleIn = (setter: typeof setSelectedCompanies) => (key: string) =>
    setter(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  const handleLoadAudience = useCallback(() => {
    if (!selectedAccount) return;
    setSelectedCompanies(new Set());
    setSelectedTitles(new Set());
    loadAudience(selectedAccount, rangeToDates(rangeDays), selectedCampaignIds);
  }, [selectedAccount, rangeDays, selectedCampaignIds, loadAudience]);

  const selectedCompanyRows = useMemo(
    () => companies.filter(c => selectedCompanies.has(c.entityUrn)),
    [companies, selectedCompanies],
  );
  const selectedTitleNames = useMemo(
    () => titles.filter(t => selectedTitles.has(t.entityUrn)).map(t => t.entityName),
    [titles, selectedTitles],
  );

  const handleFind = useCallback(() => {
    findProspects({
      companies: selectedCompanyRows.map(c => ({ urn: c.entityUrn, name: c.entityName })),
      titles: selectedTitleNames,
      seniority,
      country: country.trim(),
      perCompanyLimit: Number(perCompanyLimit),
    });
  }, [findProspects, selectedCompanyRows, selectedTitleNames, seniority, country, perCompanyLimit]);

  const handleExport = useCallback(() => {
    exportToCSV(prospects, `prospects-${new Date().toISOString().split('T')[0]}`, [
      { key: 'fullName', label: 'Name' },
      { key: 'title', label: 'Title' },
      { key: 'seniority', label: 'Seniority' },
      { key: 'companyName', label: 'Company' },
      { key: 'companyDomain', label: 'Domain' },
      { key: 'companyIndustry', label: 'Industry' },
      { key: 'companySize', label: 'Company size' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'country', label: 'Country' },
      { key: 'linkedInUrl', label: 'LinkedIn profile' },
      { key: 'sourceCompanyName', label: 'Matched from campaign company' },
      { key: 'matchedBy', label: 'Matched by' },
    ]);
  }, [prospects]);

  // Prefer the budget the last run reported — it is newer than the one the
  // status probe fetched when the tab mounted.
  const budget = runMeta?.budget ?? status?.budget ?? null;
  const remaining = rowsRemaining(budget);

  // A trial plan silently clamps `limit` to max_per_call, so offering 25 when
  // the plan returns 5 would just be a lie on the button.
  const limitChoices = useMemo(() => {
    const cap = budget?.maxPerCall ?? null;
    const allowed = cap ? PER_COMPANY_CHOICES.filter(n => n <= cap) : PER_COMPANY_CHOICES;
    return (allowed.length > 0 ? allowed : [cap ?? 5]).map(String);
  }, [budget?.maxPerCall]);

  useEffect(() => {
    if (!limitChoices.includes(perCompanyLimit)) setPerCompanyLimit(limitChoices[0]);
  }, [limitChoices, perCompanyLimit]);

  const searchCount = Math.min(selectedCompanyRows.length, 25);
  const projectedRows = searchCount * Number(perCompanyLimit);
  const overBudget = remaining !== null && projectedRows > remaining;
  const canFind = searchCount > 0 && !isFinding && status?.connected !== false;

  const campaignLabel =
    selectedCampaignIds.length === 0
      ? 'All campaigns'
      : selectedCampaignIds.length === 1
        ? campaigns.find(c => c.id === selectedCampaignIds[0])?.name || '1 campaign'
        : `${selectedCampaignIds.length} campaigns`;

  if (!selectedAccount) {
    return (
      <WidgetCard>
        <EmptyState icon={Radar} title="Pick an ad account" description="Prospect Finder works from one account's campaign demographics." />
      </WidgetCard>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {hasSession === false && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/[0.06] px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
          <div className="text-xs text-foreground/90 space-y-1">
            <p className="font-semibold">Sign in to use Prospect Finder</p>
            <p className="text-muted-foreground">
              The rest of the dashboard runs on your LinkedIn connection alone, but this tool spends
              MoltSets credits, so it is tied to an Ads Buddy account (email + password — connecting
              LinkedIn again does not sign you in).{' '}
              {/* Must be the email form: plain /auth only offers "Continue with LinkedIn", which
                  refreshes the LinkedIn token but never creates an app session — a loop. */}
              <a
                href={`/auth?mode=email&returnTo=${encodeURIComponent('/dashboard?tab=prospect_finder')}`}
                className="text-primary underline underline-offset-2"
              >
                Sign in with email
              </a>
              ; you'll come straight back here. Loading the audience below still works without it.
            </p>
          </div>
        </div>
      )}

      {hasSession !== false && status && !status.connected && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/[0.06] px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
          <div className="text-xs text-foreground/90 space-y-1">
            {status.notDeployed ? (
              <>
                <p className="font-semibold">Prospect Finder's backend isn't deployed yet</p>
                <p className="text-muted-foreground">
                  The live <code className="font-mono">linkedin-api</code> function has no{' '}
                  <code className="font-mono">moltsets_status</code> action — it answered{' '}
                  <span className="font-mono">"{status.reason}"</span>. Deploy the edge function;
                  adding the API key changes nothing until then. Loading the audience below still
                  works.
                </p>
              </>
            ) : status.callFailed ? (
              <>
                <p className="font-semibold">Couldn't check MoltSets</p>
                <p className="text-muted-foreground">
                  The connection check itself failed — <span className="font-mono">"{status.reason}"</span>.
                  This says nothing about your API key, so don't change it yet: an authentication
                  error here usually means the check outran your session. Loading the audience below
                  still works.
                </p>
                <Button variant="outline" size="sm" className="mt-1 h-7 text-xs" onClick={() => checkStatus()}>
                  Try again
                </Button>
              </>
            ) : (
              <>
                <p className="font-semibold">MoltSets is not connected</p>
                <p className="text-muted-foreground">
                  {status.reason || 'The MOLTSETS_API_KEY secret is missing.'} Add it as a Supabase
                  edge secret for <code className="font-mono">linkedin-api</code>, then redeploy the
                  function. Loading the audience below still works — only the people search needs
                  the key.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* How this works — the inference is the whole point, so say it plainly. */}
      <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/40 px-4 py-3">
        <Info className="h-4 w-4 text-primary/70 mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          LinkedIn reports demographics <span className="text-foreground font-medium">aggregated per dimension</span> —
          a list of companies and a separate list of job titles, never the individuals behind either.
          Prospect Finder searches MoltSets for people who <span className="text-foreground font-medium">match</span> the
          companies and titles you pick. These are candidates who fit your engaged audience's profile,
          not a record of who saw or clicked the ad.
        </p>
      </div>

      {/* Step 1 — scope */}
      <WidgetCard title="1 · Choose the audience to decode" subtitle="Demographics come from the campaigns and window you pick here">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Campaigns</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 justify-between min-w-[220px] text-xs">
                  {campaignLabel}
                  <ChevronDown className="h-3.5 w-3.5 ml-2 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0" align="start">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border/70">
                  <span className="text-xs font-medium">{campaigns.length} campaigns</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSelectedCampaignIds([])}>
                    All
                  </Button>
                </div>
                <ScrollArea className="h-[260px]">
                  <div className="p-1">
                    {campaigns.map(c => (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/60 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedCampaignIds.includes(c.id)}
                          onCheckedChange={() =>
                            setSelectedCampaignIds(prev =>
                              prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id],
                            )
                          }
                        />
                        <span className="text-xs truncate flex-1">{c.name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{c.status}</span>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Window</label>
            <Select value={rangeDays} onValueChange={setRangeDays}>
              <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DATE_RANGES.map(r => (
                  <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button size="sm" className="h-9" onClick={handleLoadAudience} disabled={isLoadingAudience}>
            {isLoadingAudience ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Radar className="h-3.5 w-3.5 mr-2" />}
            Load audience
          </Button>
        </div>

        {audienceError && (
          <p className="mt-3 text-xs text-destructive">{audienceError}</p>
        )}
      </WidgetCard>

      {/* Step 2 — pick the dimensions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AudiencePanel
          title="Companies with impressions"
          subtitle="Who your ads reached"
          icon={Building2}
          rows={companies}
          selected={selectedCompanies}
          onToggle={toggleIn(setSelectedCompanies)}
          onSelectTop={n => setSelectedCompanies(new Set(companies.slice(0, n).map(c => c.entityUrn)))}
          onClear={() => setSelectedCompanies(new Set())}
          isLoading={isLoadingAudience}
          emptyLabel="No company data yet"
        />
        <AudiencePanel
          title="Job titles with impressions"
          subtitle="What they do — narrows who to look for"
          icon={BriefcaseBusiness}
          rows={titles}
          selected={selectedTitles}
          onToggle={toggleIn(setSelectedTitles)}
          onSelectTop={n => setSelectedTitles(new Set(titles.slice(0, n).map(t => t.entityUrn)))}
          onClear={() => setSelectedTitles(new Set())}
          isLoading={isLoadingAudience}
          emptyLabel="No job title data yet"
        />
      </div>

      {/* Step 3 — search */}
      <WidgetCard
        title="2 · Find the people"
        subtitle={
          searchCount === 0
            ? 'Select at least one company above'
            : `${searchCount} ${searchCount === 1 ? 'search' : 'searches'} — one per company, up to ${perCompanyLimit} people each (${projectedRows} rows)`
        }
        toolbar={
          budget ? (
            <span className="flex items-center gap-2">
              {budget.plan && (
                <Badge variant="outline" className="text-[10px] capitalize">{budget.plan} plan</Badge>
              )}
              {remaining !== null && (
                <StatusPill
                  tone={overBudget ? 'warning' : remaining > 0 ? 'neutral' : 'danger'}
                  label={`${fmtNum(remaining)}${budget.searchResultsTotal ? `/${fmtNum(budget.searchResultsTotal)}` : ''} rows left`}
                />
              )}
            </span>
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Seniority (optional)</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 justify-between min-w-[170px] text-xs">
                  {seniority.length === 0 ? 'Any seniority' : `${seniority.length} selected`}
                  <ChevronDown className="h-3.5 w-3.5 ml-2 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-1" align="start">
                {SENIORITY_OPTIONS.map(s => (
                  <label key={s} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/60 cursor-pointer">
                    <Checkbox
                      checked={seniority.includes(s)}
                      onCheckedChange={() =>
                        setSeniority(prev => (prev.includes(s) ? prev.filter(v => v !== s) : [...prev, s]))
                      }
                    />
                    <span className="text-xs">{s}</span>
                  </label>
                ))}
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Country (optional)</label>
            <Input
              value={country}
              onChange={e => setCountry(e.target.value)}
              placeholder="United States"
              className="h-9 w-[180px] text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">People per company</label>
            <Select value={perCompanyLimit} onValueChange={setPerCompanyLimit}>
              <SelectTrigger className="h-9 w-[120px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {limitChoices.map(n => (
                  <SelectItem key={n} value={n} className="text-xs">{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button size="sm" className="h-9" onClick={handleFind} disabled={!canFind}>
            {isFinding ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Users className="h-3.5 w-3.5 mr-2" />}
            Find people
          </Button>
        </div>

        {overBudget && (
          <p className="mt-3 text-xs text-warning">
            This run asks for {fmtNum(projectedRows)} rows but only {fmtNum(remaining ?? 0)} remain on
            your plan. Reduce the companies or the per-company count, or it will stop part-way through.
          </p>
        )}
        {budget?.maxPerCall && budget.maxPerCall < 25 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Your plan caps search results at {budget.maxPerCall} per company — higher values are
            silently clamped, so they aren't offered.
          </p>
        )}
        {selectedTitleNames.length === 0 && searchCount > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            No job titles selected — this will return each company's best matches regardless of role.
          </p>
        )}
        {selectedCompanyRows.length > 25 && (
          <p className="mt-3 text-xs text-warning">
            {selectedCompanyRows.length} companies selected; only the first 25 are searched per run.
          </p>
        )}
        {findError && <p className="mt-3 text-xs text-destructive">{findError}</p>}
      </WidgetCard>

      {/* Results */}
      {(prospects.length > 0 || companyResults.length > 0) && (
        <WidgetCard
          title={`${prospects.length} ${prospects.length === 1 ? 'person' : 'people'} found`}
          subtitle={
            runMeta
              ? `${runMeta.companiesSearched} companies searched · ${runMeta.domainsResolved} matched by domain${
                  runMeta.companiesErrored > 0 ? ` · ${runMeta.companiesErrored} failed` : ''
                }`
              : undefined
          }
          toolbar={
            prospects.length > 0 ? (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleExport}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> CSV
              </Button>
            ) : undefined
          }
          noPadding
        >
          {prospects.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No one matched"
              description="Try fewer job titles, a broader seniority filter, or drop the country."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-y border-border/70 bg-muted/30">
                  <tr className="text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-left font-medium">Title</th>
                    <th className="px-3 py-2 text-left font-medium">Company</th>
                    <th className="px-3 py-2 text-left font-medium">Location</th>
                    <th className="px-3 py-2 text-left font-medium">From</th>
                    <th className="px-3 py-2 text-right font-medium">Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {prospects.map((p, i) => (
                    <tr key={`${p.linkedInUrl ?? p.fullName}-${i}`} className="border-b border-border/40 hover:bg-muted/40">
                      <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{p.fullName}</td>
                      <td className="px-3 py-2 max-w-[240px] truncate" title={p.headline || p.title || ''}>
                        {p.title || '—'}
                        {p.seniority && (
                          <span className="ml-1.5 text-[10px] text-muted-foreground">({p.seniority})</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-foreground">{p.companyName || '—'}</span>
                        {p.companyDomain && (
                          <span className="block text-[10px] text-muted-foreground">{p.companyDomain}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{locationOf(p)}</td>
                      <td className="px-3 py-2">
                        <span className="text-muted-foreground">{p.sourceCompanyName || '—'}</span>
                        {p.matchedBy === 'name' && (
                          <span
                            className="block text-[10px] text-warning"
                            title="LinkedIn gave no website for this company, so the match is by name and may include a different company of the same name."
                          >
                            name match
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {p.linkedInUrl ? (
                          <a
                            href={p.linkedInUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            Open <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Per-company outcome — a company with no match is normal; an error is not. */}
          {companyResults.length > 0 && (
            <div className="px-5 py-4 border-t border-border/70 flex flex-wrap gap-2">
              {companyResults.map((r, i) => (
                <StatusPill
                  key={`${r.urn ?? r.name ?? 'company'}-${i}`}
                  tone={r.status === 'ok' ? 'success' : r.status === 'not_found' ? 'neutral' : 'danger'}
                  label={`${r.name || r.domain || 'Unknown'}${r.status === 'ok' ? ` · ${r.returned}` : r.status === 'not_found' ? ' · none' : ' · failed'}`}
                  className={r.error ? 'cursor-help' : undefined}
                />
              ))}
            </div>
          )}
        </WidgetCard>
      )}
    </div>
  );
}

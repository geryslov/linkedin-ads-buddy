import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLinkedInAuth } from "@/hooks/useLinkedInAuth";
import { useLinkedInAds } from "@/hooks/useLinkedInAds";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AccountSelector } from "@/components/dashboard/AccountSelector";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { CampaignTable } from "@/components/dashboard/CampaignTable";
import { AudienceInsightsHub } from "@/components/dashboard/AudienceInsightsHub";
import { ReportingSection } from "@/components/dashboard/ReportingSection";
import { TitleCheckerPage } from "@/components/dashboard/TitleCheckerPage";
import { CompanyEngagementTimeline } from "@/components/dashboard/CompanyEngagementTimeline";
import { MegaBudgetPacingDashboard } from "@/components/dashboard/MegaBudgetPacingDashboard";
import { CreativeGallery } from "@/components/dashboard/CreativeGallery";
import { BulkCreativeCopy } from "@/components/dashboard/BulkCreativeCopy";
import { CampaignTargetingEditor } from "@/components/dashboard/CampaignTargetingEditor";
import { CreativePerformanceReport } from "@/components/dashboard/CreativePerformanceReport";
import { CampaignPerformanceReport } from "@/components/dashboard/CampaignPerformanceReport";
import { CompanyInfluenceMatcher } from "@/components/dashboard/CompanyInfluenceMatcher";
import { StandardizedTitlesPage } from "@/components/dashboard/StandardizedTitlesPage";
import { NamingConventionReport } from "@/components/dashboard/NamingConventionReport";
import { CompanyConversionBreakdown } from "@/components/dashboard/CompanyConversionBreakdown";
import { LeadSyncReport } from "@/components/dashboard/LeadSyncReport";
import { LeadRecordsViewer } from "@/components/dashboard/LeadRecordsViewer";
import { WeeklyReport } from "@/components/dashboard/WeeklyReport";
import { ActivityReport } from "@/components/dashboard/ActivityReport";
import { AnalyticsDashboard } from "@/components/dashboard/AnalyticsDashboard";
import { CreativeAnalyzer } from "@/components/dashboard/CreativeAnalyzer";
import { LeadGenAnalyzer } from "@/components/dashboard/LeadGenAnalyzer";
import { AgenticChatDrawer } from "@/components/dashboard/AgenticChatDrawer";
import { AccountHealthCheck } from "@/components/dashboard/AccountHealthCheck";
import { PerformanceSegmentation } from "@/components/dashboard/PerformanceSegmentation";
import { ConnectClaude } from "@/components/dashboard/ConnectClaude";
import { CommandPalette } from "@/components/dashboard/CommandPalette";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WidgetCard, EmptyState, StatusPill } from "@/components/dashboard/widgets";
import {
  Eye,
  MousePointerClick,
  DollarSign,
  Target,
  RefreshCw,
  ChevronRight,
  Megaphone,
} from "lucide-react";

// U8 — Page metadata: group label, title, and contextual subtitle
const tabMeta: Record<string, { group: string; title: string; subtitle: string }> = {
  overview:            { group: "",           title: "Dashboard Overview",          subtitle: "Your LinkedIn Ads performance at a glance" },
  campaigns:           { group: "Campaigns",  title: "Campaign Management",         subtitle: "Manage and monitor your active campaigns" },
  budget_pacing:       { group: "Campaigns",  title: "Budget Pacing",               subtitle: "Track budget distribution across campaigns" },
  creatives:           { group: "Campaigns",  title: "Ad Creatives",                subtitle: "Browse and analyze your creative assets" },
  bulk_add_creatives:  { group: "Bulk Editing", title: "Add Ads to Campaigns",       subtitle: "Copy existing ads into other campaigns in bulk" },
  campaign_editor:     { group: "Bulk Editing", title: "Campaign Editor",             subtitle: "Bulk-edit targeting across multiple campaigns" },
  audience_templates:  { group: "Bulk Editing", title: "Audience Templates",          subtitle: "Save reusable audiences and run them on chosen campaigns" },
  analytics:           { group: "Analytics",  title: "Analytics",                   subtitle: "Performance metrics and key insights" },
  campaign_reports:    { group: "Analytics",  title: "Campaign Reports",            subtitle: "Detailed campaign performance breakdown" },
  creative_reports:    { group: "Analytics",  title: "Creative Reports",            subtitle: "Creative-level performance analysis" },
  reports:             { group: "Analytics",  title: "Reports",                     subtitle: "Comprehensive ad performance reports" },
  weekly_report:       { group: "Analytics",  title: "Weekly Report",               subtitle: "Week-over-week performance by creative, campaign, and lead form" },
  conv_breakdown:      { group: "Analytics",  title: "Conv. Breakdown",             subtitle: "Company × conversion cross-tab analysis" },
  audiences:           { group: "Audience",   title: "Audience Insights",           subtitle: "Understand and manage your target audiences" },
  company_timeline:    { group: "Audience",   title: "Company Timeline",            subtitle: "Track company engagement over time" },
  influence_matcher:   { group: "Audience",   title: "Influence Matcher",           subtitle: "Match companies to influential contacts" },
  title_checker:       { group: "Tools",      title: "Title Checker",               subtitle: "Validate and explore job titles" },
  standardized_titles: { group: "Tools",      title: "Standardized Titles",         subtitle: "Normalize job title variations" },
  name_report:         { group: "Tools",      title: "Name Report",                 subtitle: "Analyze campaign naming conventions" },
  forms_leads:         { group: "Leads",      title: "Forms & Leads",               subtitle: "Lead generation form submissions and responses" },
  lead_records:        { group: "Leads",      title: "Lead Records",                subtitle: "Browse all registered leads across your forms" },
  activity_report:     { group: "Analytics",  title: "Activity Report",              subtitle: "Track performance of grouped campaign activities" },
  creative_analyzer:   { group: "Analytics",  title: "Creative Analyzer",            subtitle: "AI-powered creative fatigue detection and pattern analysis" },
  lead_gen_analyzer:   { group: "Analytics",  title: "Lead Gen Analyzer",             subtitle: "CPL analysis, form quality, creative performance for lead generation campaigns" },
  account_health:      { group: "Analytics",  title: "Account Health",                subtitle: "AI-powered account diagnosis with severity-ranked action items" },
  segmentation:        { group: "Analytics",  title: "Segmentation",                  subtitle: "Performance segmentation by business line, objective, activity, and audience" },
};

export default function Dashboard() {
  const { accessToken, profile, logout } = useLinkedInAuth();
  const { isAdmin } = useAuth();
  const {
    adAccounts,
    selectedAccount,
    setSelectedAccount,
    campaigns,
    analytics,
    audiences,
    isLoading,
    isSyncing,
    lastSyncedAt,
    currentAccountCanWrite,
    fetchAdAccounts,
    fetchCampaigns,
    fetchAnalytics,
    fetchAudiences,
    updateCampaignStatus,
    setDefaultAccount,
    syncAdAccounts,
  } = useLinkedInAds(accessToken);

  // Tab state lives in the URL (?tab=…) so views are deep-linkable
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "overview";
  const setActiveTab = useCallback(
    (tab: string) => setSearchParams(tab === "overview" ? {} : { tab }),
    [setSearchParams]
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [connectClaudeOpen, setConnectClaudeOpen] = useState(false);
  const lastFetchedAccountsTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!accessToken) {
      lastFetchedAccountsTokenRef.current = null;
      return;
    }

    if (lastFetchedAccountsTokenRef.current !== accessToken) {
      lastFetchedAccountsTokenRef.current = accessToken;
      fetchAdAccounts();
    }
  }, [accessToken, fetchAdAccounts]);

  useEffect(() => {
    if (selectedAccount) {
      fetchCampaigns(selectedAccount);
      fetchAnalytics(selectedAccount);
      fetchAudiences(selectedAccount);
    }
  }, [selectedAccount, fetchCampaigns, fetchAnalytics, fetchAudiences]);

  // Track linked account when user selects one
  useEffect(() => {
    const trackLinkedAccount = async () => {
      if (!selectedAccount) return;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      
      const selectedAccountData = adAccounts.find(a => a.id === selectedAccount);
      
      await supabase
        .from('user_linked_accounts')
        .upsert({
          user_id: session.user.id,
          account_id: selectedAccount,
          account_name: selectedAccountData?.name || null,
          last_accessed_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,account_id',
        });
    };
    
    trackLinkedAccount();
  }, [selectedAccount, adAccounts]);

  const handleRefresh = () => {
    if (selectedAccount) {
      fetchCampaigns(selectedAccount);
      fetchAnalytics(selectedAccount);
      fetchAudiences(selectedAccount);
    }
  };

  const handleAccountChange = (accountId: string) => {
    setSelectedAccount(accountId);
  };

  const profileName = profile 
    ? `${profile.localizedFirstName} ${profile.localizedLastName}` 
    : undefined;

  const meta = tabMeta[activeTab] ?? { group: "", title: "Dashboard", subtitle: "" };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={logout}
        profileName={profileName}
        isAdmin={isAdmin}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        onConnectClaude={() => setConnectClaudeOpen(true)}
      />
      <ConnectClaude
        open={connectClaudeOpen}
        onOpenChange={setConnectClaudeOpen}
        accessToken={accessToken}
      />

      <main className={cn("transition-all duration-300 min-h-screen", sidebarCollapsed ? "ml-16" : "ml-64")}>
        {/* ── Sticky top header bar ───────────────────────────── */}
        <header className="sticky top-0 z-20 bg-background/85 backdrop-blur-md border-b border-border/60 px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 min-w-0 text-[13px]">
            {/* Breadcrumb */}
            {meta.group && (
              <>
                <span className="text-muted-foreground shrink-0">{meta.group}</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
              </>
            )}
            <h1 className="font-semibold truncate">{meta.title}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <CommandPalette
              onNavigate={setActiveTab}
              onConnectClaude={() => setConnectClaudeOpen(true)}
              onLogout={logout}
              isAdmin={isAdmin}
            />
            <AccountSelector
              accounts={adAccounts}
              selectedAccount={selectedAccount}
              onSelect={handleAccountChange}
              onSetDefault={setDefaultAccount}
              onRefresh={syncAdAccounts}
              isRefreshing={isSyncing}
              lastSyncedAt={lastSyncedAt}
            />
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handleRefresh}
              disabled={isLoading}
              title="Refresh data"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            </Button>
          </div>
        </header>

        {/* ── Page content ────────────────────────────────────── */}
        <div className="px-6 py-8 max-w-[1440px] mx-auto">
          {/* Page title + subtitle */}
          <div className="mb-8">
            <h2 className="font-display text-[26px] font-semibold text-foreground leading-tight">
              {meta.title}
            </h2>
            {meta.subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{meta.subtitle}</p>
            )}
          </div>

        <ErrorBoundary resetKey={activeTab} label={meta.title}>
        <div key={activeTab} className="animate-fade-in">
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {isLoading || !analytics ? (
                <>
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-32 rounded-xl bg-secondary" />
                  ))}
                </>
              ) : (
                <>
                  <MetricCard
                    title="Impressions"
                    value={analytics.impressions.toLocaleString()}
                    icon={Eye}
                    delay={0}
                  />
                  <MetricCard
                    title="Clicks"
                    value={analytics.clicks.toLocaleString()}
                    icon={MousePointerClick}
                    delay={50}
                  />
                  <MetricCard
                    title="Total Spend"
                    value={`$${parseFloat(analytics.costInLocalCurrency).toLocaleString()}`}
                    icon={DollarSign}
                    delay={100}
                  />
                  <MetricCard
                    title="Conversions"
                    value={analytics.conversions.toLocaleString()}
                    icon={Target}
                    delay={150}
                  />
                </>
              )}
            </div>

            {/* Derived efficiency strip — computed from the same aggregates */}
            {analytics && !isLoading && (() => {
              const spend = parseFloat(analytics.costInLocalCurrency) || 0;
              const derived = [
                {
                  label: "CTR",
                  value: analytics.impressions > 0
                    ? `${((analytics.clicks / analytics.impressions) * 100).toFixed(2)}%`
                    : "—",
                },
                {
                  label: "CPC",
                  value: analytics.clicks > 0 ? `$${(spend / analytics.clicks).toFixed(2)}` : "—",
                },
                {
                  label: "CPM",
                  value: analytics.impressions > 0
                    ? `$${((spend / analytics.impressions) * 1000).toFixed(2)}`
                    : "—",
                },
                {
                  label: "Cost / conversion",
                  value: analytics.conversions > 0 ? `$${(spend / analytics.conversions).toFixed(2)}` : "—",
                },
              ];
              return (
                <WidgetCard noPadding className="animate-slide-up">
                  <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border/60">
                    {derived.map((d) => (
                      <div key={d.label} className="px-5 py-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          {d.label}
                        </p>
                        <p className="text-lg font-bold tabular-nums mt-1">{d.value}</p>
                      </div>
                    ))}
                  </div>
                </WidgetCard>
              );
            })()}

            {/* Recent campaigns — light list, full table lives in the Campaigns tab */}
            {isLoading ? (
              <Skeleton className="h-64 rounded-xl bg-secondary" />
            ) : (
              <WidgetCard
                noPadding
                title="Recent campaigns"
                subtitle="Latest 6 campaigns on this account"
                toolbar={
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveTab("campaigns")}>
                    View all
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                }
              >
                {campaigns.length === 0 ? (
                  <EmptyState
                    icon={Megaphone}
                    title="No campaigns yet"
                    description="Create your first campaign in LinkedIn Campaign Manager and it will appear here automatically."
                  />
                ) : (
                  <ul className="divide-y divide-border/60">
                    {campaigns.slice(0, 6).map((c) => {
                      const tone =
                        c.status === "ACTIVE" ? "success"
                        : c.status === "PAUSED" ? "warning"
                        : c.status === "DRAFT" ? "info"
                        : "neutral";
                      const label = c.status.charAt(0) + c.status.slice(1).toLowerCase();
                      return (
                        <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium" title={c.name}>
                            {c.name}
                          </span>
                          <span className="hidden md:inline text-xs text-muted-foreground shrink-0">
                            {c.type}
                          </span>
                          <span className="hidden sm:inline text-sm tabular-nums text-muted-foreground shrink-0 w-28 text-right">
                            {c.dailyBudget
                              ? `${c.dailyBudget.currencyCode} ${parseFloat(c.dailyBudget.amount).toLocaleString()}/d`
                              : "—"}
                          </span>
                          <StatusPill tone={tone} label={label} className="shrink-0" />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </WidgetCard>
            )}
          </div>
        )}

        {activeTab === "campaigns" && (
          <CampaignTable
            campaigns={campaigns}
            onStatusChange={updateCampaignStatus}
            isLoading={isLoading}
          />
        )}

        {activeTab === "audiences" && (
          <AudienceInsightsHub
            audiences={audiences}
            isLoading={isLoading}
            accessToken={accessToken}
            selectedAccount={selectedAccount}
          />
        )}

        {activeTab === "analytics" && (
          <AnalyticsDashboard
            accessToken={accessToken}
            selectedAccount={selectedAccount}
          />
        )}

        {activeTab === "budget_pacing" && (
          <MegaBudgetPacingDashboard
            accessToken={accessToken}
            adAccounts={adAccounts}
          />
        )}

        {activeTab === "company_timeline" && (
          <CompanyEngagementTimeline
            accessToken={accessToken}
            selectedAccount={selectedAccount}
          />
        )}

        {activeTab === "creatives" && (
          <CreativeGallery
            accessToken={accessToken}
            selectedAccount={selectedAccount}
          />
        )}

        {activeTab === "bulk_add_creatives" && (
          <BulkCreativeCopy
            accessToken={accessToken}
            selectedAccount={selectedAccount}
          />
        )}

        {activeTab === "campaign_editor" && (
          <CampaignTargetingEditor
            accessToken={accessToken}
            selectedAccount={selectedAccount}
            campaigns={campaigns.map((c) => ({ id: c.id, name: c.name, status: c.status }))}
            canWrite={currentAccountCanWrite}
            onRefreshCampaigns={() => selectedAccount && fetchCampaigns(selectedAccount)}
          />
        )}

        {activeTab === "audience_templates" && (
          <AudienceTemplates
            accessToken={accessToken}
            selectedAccount={selectedAccount}
            campaigns={campaigns.map((c) => ({ id: c.id, name: c.name, status: c.status }))}
            canWrite={currentAccountCanWrite}
          />
        )}



        {activeTab === "reports" && (
          <ReportingSection
            accessToken={accessToken}
            selectedAccount={selectedAccount}
            canWrite={currentAccountCanWrite}
          />
        )}

        {activeTab === "creative_reports" && (
          <CreativePerformanceReport
            accessToken={accessToken}
            selectedAccount={selectedAccount}
          />
        )}

        {activeTab === "campaign_reports" && (
          <CampaignPerformanceReport
            accessToken={accessToken}
            selectedAccount={selectedAccount}
          />
        )}

        {activeTab === "title_checker" && (
          <TitleCheckerPage
            accessToken={accessToken}
            selectedAccount={selectedAccount}
          />
        )}

        {activeTab === "influence_matcher" && (
          <CompanyInfluenceMatcher
            accessToken={accessToken}
            selectedAccount={selectedAccount}
          />
        )}

        {activeTab === "standardized_titles" && (
          <StandardizedTitlesPage
            accessToken={accessToken}
            selectedAccount={selectedAccount}
          />
        )}

        {activeTab === "name_report" && (
          <NamingConventionReport
            accessToken={accessToken}
            selectedAccount={selectedAccount}
          />
        )}

        {activeTab === "weekly_report" && (
          <WeeklyReport
            accessToken={accessToken}
            selectedAccount={selectedAccount}
          />
        )}

        {activeTab === "conv_breakdown" && (
          <CompanyConversionBreakdown
            accessToken={accessToken}
            selectedAccount={selectedAccount}
          />
        )}

        {activeTab === "forms_leads" && (
          <LeadSyncReport
            accessToken={accessToken}
            selectedAccount={selectedAccount}
          />
        )}

        {activeTab === "lead_records" && (
          <LeadRecordsViewer
            accessToken={accessToken}
            selectedAccount={selectedAccount}
          />
        )}

        {activeTab === "activity_report" && (
          <ActivityReport
            accessToken={accessToken}
            selectedAccount={selectedAccount}
          />
        )}

        {activeTab === "creative_analyzer" && (
          <CreativeAnalyzer
            accessToken={accessToken}
            selectedAccount={selectedAccount}
          />
        )}

        {activeTab === "lead_gen_analyzer" && (
          <LeadGenAnalyzer
            accessToken={accessToken}
            selectedAccount={selectedAccount}
          />
        )}

        {activeTab === "account_health" && (
          <AccountHealthCheck
            accessToken={accessToken}
            selectedAccount={selectedAccount}
          />
        )}

        {activeTab === "segmentation" && (
          <PerformanceSegmentation
            accessToken={accessToken}
            selectedAccount={selectedAccount}
          />
        )}
        </div>{/* end animated tab wrapper */}
        </ErrorBoundary>
        </div>{/* end p-6 content wrapper */}
      </main>

      {/* Global AI Advisor — floating chat available on every tab */}
      <AgenticChatDrawer accessToken={accessToken} selectedAccount={selectedAccount} />
    </div>
  );
}

import { useEffect, useState } from "react";
import { useLinkedInAuth } from "@/hooks/useLinkedInAuth";
import { useLinkedInAds } from "@/hooks/useLinkedInAds";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { AccountSelector } from "@/components/dashboard/AccountSelector";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { CampaignTable } from "@/components/dashboard/CampaignTable";
import { AudienceInsightsHub } from "@/components/dashboard/AudienceInsightsHub";
import { ReportingSection } from "@/components/dashboard/ReportingSection";
import { TitleCheckerPage } from "@/components/dashboard/TitleCheckerPage";
import { CompanyEngagementTimeline } from "@/components/dashboard/CompanyEngagementTimeline";
import { MegaBudgetPacingDashboard } from "@/components/dashboard/MegaBudgetPacingDashboard";
import { CreativeGallery } from "@/components/dashboard/CreativeGallery";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Eye,
  MousePointerClick,
  DollarSign,
  Target,
  RefreshCw,
  TrendingUp,
  Percent,
  ChevronRight,
} from "lucide-react";

// U8 — Page metadata: group label, title, and contextual subtitle
const tabMeta: Record<string, { group: string; title: string; subtitle: string }> = {
  overview:            { group: "",           title: "Dashboard Overview",          subtitle: "Your LinkedIn Ads performance at a glance" },
  campaigns:           { group: "Campaigns",  title: "Campaign Management",         subtitle: "Manage and monitor your active campaigns" },
  budget_pacing:       { group: "Campaigns",  title: "Budget Pacing",               subtitle: "Track budget distribution across campaigns" },
  creatives:           { group: "Campaigns",  title: "Ad Creatives",                subtitle: "Browse and analyze your creative assets" },
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

  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (accessToken) {
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
      />

      <main className={cn("transition-all duration-300 min-h-screen", sidebarCollapsed ? "ml-16" : "ml-64")}>
        {/* ── Sticky top header bar ───────────────────────────── */}
        <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/60 px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            {/* Breadcrumb */}
            {meta.group && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <span className="font-medium">{meta.group}</span>
                <ChevronRight className="h-3 w-3" />
              </div>
            )}
            <h1 className="text-sm font-semibold truncate">{meta.title}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
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
        <div className="p-6">
          {/* Page title + subtitle (below header bar) */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-foreground">{meta.title}</h2>
            {meta.subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5">{meta.subtitle}</p>
            )}
          </div>

        {activeTab === "overview" && (
          <div className="space-y-8">
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

            <div>
              <h3 className="text-base font-semibold mb-3 text-foreground">Recent Campaigns</h3>
              {isLoading ? (
                <Skeleton className="h-64 rounded-xl bg-secondary" />
              ) : (
                <CampaignTable 
                  campaigns={campaigns.slice(0, 5)} 
                  onStatusChange={updateCampaignStatus}
                  isLoading={isLoading}
                />
              )}
            </div>
          </div>
        )}

        {activeTab === "campaigns" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <MetricCard
                title="Active Campaigns"
                value={campaigns.filter(c => c.status === "ACTIVE").length}
                icon={TrendingUp}
                delay={0}
              />
              <MetricCard
                title="Paused Campaigns"
                value={campaigns.filter(c => c.status === "PAUSED").length}
                icon={Target}
                delay={50}
              />
              <MetricCard
                title="Total Campaigns"
                value={campaigns.length}
                icon={Percent}
                delay={100}
              />
            </div>
            
            <CampaignTable 
              campaigns={campaigns} 
              onStatusChange={updateCampaignStatus}
              isLoading={isLoading}
            />
          </div>
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
        </div>{/* end p-6 content wrapper */}
      </main>
    </div>
  );
}

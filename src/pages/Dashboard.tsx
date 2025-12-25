import { useEffect, useState } from "react";
import { useLinkedInAuth } from "@/hooks/useLinkedInAuth";
import { useLinkedInAds } from "@/hooks/useLinkedInAds";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { AccountSelector } from "@/components/dashboard/AccountSelector";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { CampaignTable } from "@/components/dashboard/CampaignTable";
import { AudienceCard } from "@/components/dashboard/AudienceCard";
import { ReportingSection } from "@/components/dashboard/ReportingSection";
import { TitlesApiTestModal } from "@/components/dashboard/TitlesApiTestModal";
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
} from "lucide-react";

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
    fetchAdAccounts,
    fetchCampaigns,
    fetchAnalytics,
    fetchAudiences,
    updateCampaignStatus,
  } = useLinkedInAds(accessToken);

  const [activeTab, setActiveTab] = useState("overview");

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

  return (
    <div className="min-h-screen bg-background">
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        onLogout={logout}
        profileName={profileName}
        isAdmin={isAdmin}
      />
      
      <main className="ml-64 p-8">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1">
              {activeTab === "overview" && "Dashboard Overview"}
              {activeTab === "campaigns" && "Campaign Management"}
              {activeTab === "audiences" && "Audience Insights"}
              {activeTab === "analytics" && "Analytics & Reports"}
              {activeTab === "reports" && "Reports"}
            </h1>
            <p className="text-muted-foreground">
              Manage your LinkedIn advertising campaigns
            </p>
          </div>
          <div className="flex items-center gap-4">
            <TitlesApiTestModal accessToken={accessToken} />
            <AccountSelector 
              accounts={adAccounts}
              selectedAccount={selectedAccount}
              onSelect={handleAccountChange}
            />
            <Button 
              variant="outline" 
              size="icon"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </header>

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
                    change="+12.5% from last period"
                    changeType="positive"
                    icon={Eye}
                    delay={0}
                  />
                  <MetricCard
                    title="Clicks"
                    value={analytics.clicks.toLocaleString()}
                    change="+8.2% from last period"
                    changeType="positive"
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
                    change="+15.3% from last period"
                    changeType="positive"
                    icon={Target}
                    delay={150}
                  />
                </>
              )}
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">Recent Campaigns</h2>
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
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-40 rounded-xl bg-secondary" />
                ))
              ) : audiences.length > 0 ? (
                audiences.map((audience, i) => (
                  <AudienceCard 
                    key={audience.id} 
                    audience={audience} 
                    delay={i * 50}
                  />
                ))
              ) : (
                <div className="col-span-full glass rounded-xl p-12 text-center">
                  <p className="text-muted-foreground">No audiences found for this account</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {analytics && (
                <>
                  <MetricCard
                    title="Click-Through Rate"
                    value={`${analytics.ctr}%`}
                    icon={MousePointerClick}
                    delay={0}
                  />
                  <MetricCard
                    title="Cost Per Click"
                    value={`$${analytics.cpc}`}
                    icon={DollarSign}
                    delay={50}
                  />
                  <MetricCard
                    title="Total Impressions"
                    value={analytics.impressions.toLocaleString()}
                    icon={Eye}
                    delay={100}
                  />
                  <MetricCard
                    title="Total Conversions"
                    value={analytics.conversions.toLocaleString()}
                    icon={Target}
                    delay={150}
                  />
                </>
              )}
            </div>
            
            <div className="glass rounded-xl p-8 animate-slide-up" style={{ animationDelay: '200ms' }}>
              <h3 className="text-lg font-semibold mb-4">Performance Summary</h3>
              <p className="text-muted-foreground">
                Detailed analytics charts and performance tracking will appear here once you have more campaign data.
              </p>
            </div>
          </div>
        )}

        {activeTab === "reports" && (
          <ReportingSection 
            accessToken={accessToken} 
            selectedAccount={selectedAccount}
          />
        )}
      </main>
    </div>
  );
}

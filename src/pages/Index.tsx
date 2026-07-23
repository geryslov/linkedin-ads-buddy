import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLinkedInAuth } from "@/hooks/useLinkedInAuth";
import { Button } from "@/components/ui/button";
import {
  Linkedin,
  BarChart3,
  Users,
  Megaphone,
  ArrowRight,
  Loader2,
  Sparkles,
  ShieldCheck,
  Eye,
  MousePointerClick,
  DollarSign,
  Target,
} from "lucide-react";

const features = [
  {
    icon: BarChart3,
    title: "Campaign Analytics",
    description:
      "Impressions, clicks, conversions and ROI — tracked in real time across every account you manage.",
  },
  {
    icon: Megaphone,
    title: "Campaign Management",
    description:
      "Pause, optimize, and bulk-edit campaigns from one dashboard instead of twelve LinkedIn tabs.",
  },
  {
    icon: Users,
    title: "Audience Insights",
    description:
      "See exactly which companies, titles, and seniorities your budget is reaching — and which it isn't.",
  },
  {
    icon: Sparkles,
    title: "AI Reports & Advisor",
    description:
      "Claude-written weekly narratives, account health checks, and an always-on advisor built into every page.",
  },
];

/* Static preview numbers for the hero mockup — illustrative only */
const previewStats = [
  { icon: Eye, label: "Impressions", value: "1.24M", delta: "+12.4%" },
  { icon: MousePointerClick, label: "Clicks", value: "18,392", delta: "+8.1%" },
  { icon: DollarSign, label: "Spend", value: "$42,730", delta: "-3.2%" },
  { icon: Target, label: "Conversions", value: "1,208", delta: "+21.7%" },
];

const previewBars = [42, 58, 45, 66, 52, 74, 61, 83, 70, 92, 78, 88];

export default function Index() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, initiateAuth } = useLinkedInAuth();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient mesh backdrop */}
      <div aria-hidden className="absolute inset-0 gradient-mesh" />

      <div className="relative z-10">
        {/* ── Nav ─────────────────────────────────────────────── */}
        <header className="sticky top-0 z-20 border-b border-border/50 bg-background/80 backdrop-blur-md">
          <div className="container mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl gradient-primary glow-primary flex items-center justify-center">
                <Linkedin className="h-[18px] w-[18px] text-primary-foreground" />
              </div>
              <span className="font-bold text-[15px] tracking-tight">
                LinkedIn Ads Manager
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={initiateAuth}
              disabled={isLoading}
              className="rounded-full px-4"
            >
              Sign in
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </header>

        {/* ── Hero ────────────────────────────────────────────── */}
        <main className="container mx-auto px-6 pt-20 pb-24">
          <div className="max-w-3xl mx-auto text-center space-y-7">
            <div className="inline-flex items-center gap-2 pl-2 pr-3.5 py-1.5 rounded-full glass text-[13px] font-medium text-muted-foreground">
              <span className="relative flex h-2 w-2 ml-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </span>
              Connected to the LinkedIn Marketing API
            </div>

            <h1 className="font-display text-5xl md:text-6xl lg:text-[68px] font-semibold leading-[1.05] text-foreground">
              Your LinkedIn ads,
              <br />
              <span className="text-gradient italic">finally legible.</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              One dashboard for analytics, bulk editing, audience intelligence, and
              AI-written client reports — everything LinkedIn Campaign Manager
              should have been.
            </p>

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="hero" size="lg" onClick={initiateAuth} disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Linkedin className="h-5 w-5" />
                )}
                Connect LinkedIn Account
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>

            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              OAuth only — your credentials never touch our servers.
            </p>
          </div>

          {/* ── Product preview mockup ────────────────────────── */}
          <div className="max-w-4xl mx-auto mt-16 relative">
            <div
              aria-hidden
              className="absolute -inset-8 rounded-[32px] opacity-60"
              style={{ background: "var(--gradient-glow)" }}
            />
            <div className="relative rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
              {/* Faux window chrome */}
              <div className="h-10 px-4 flex items-center gap-2 border-b border-border/70 bg-secondary/50">
                <span className="h-2.5 w-2.5 rounded-full bg-[#f87171]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#fbbf24]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#34d399]" />
                <span className="ml-3 text-[11px] text-muted-foreground font-medium">
                  Dashboard Overview
                </span>
              </div>
              <div className="p-5 md:p-6 space-y-5">
                {/* KPI row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {previewStats.map((s) => (
                    <div
                      key={s.label}
                      className="rounded-xl border border-border/70 bg-background/60 p-3.5 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <s.icon className="h-3.5 w-3.5 text-primary" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider">
                            {s.label}
                          </span>
                        </div>
                        <span
                          className={
                            s.delta.startsWith("-")
                              ? "text-[10px] font-semibold text-destructive"
                              : "text-[10px] font-semibold text-success"
                          }
                        >
                          {s.delta}
                        </span>
                      </div>
                      <p className="mt-2 text-xl font-bold tabular-nums tracking-tight">
                        {s.value}
                      </p>
                    </div>
                  ))}
                </div>
                {/* Faux bar chart */}
                <div className="rounded-xl border border-border/70 bg-background/60 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold">Weekly performance</span>
                    <span className="text-[10px] text-muted-foreground">Last 12 weeks</span>
                  </div>
                  <div className="flex items-end gap-1.5 h-24">
                    {previewBars.map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t-[4px] bg-primary/80"
                        style={{ height: `${h}%`, opacity: 0.55 + (i / previewBars.length) * 0.45 }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Features ──────────────────────────────────────── */}
          <div className="max-w-5xl mx-auto mt-24">
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-center mb-3">
              Built for the work agencies actually do
            </h2>
            <p className="text-muted-foreground text-center max-w-xl mx-auto mb-12">
              Reporting, bulk operations, and client communication — the 80% of ads
              work that happens after the campaign goes live.
            </p>
            <div className="grid sm:grid-cols-2 gap-5">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="glass card-hover rounded-2xl p-7 text-left"
                >
                  <div className="h-11 w-11 rounded-xl bg-primary/[0.08] border border-primary/10 flex items-center justify-center mb-5">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold mb-1.5">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Bottom CTA ────────────────────────────────────── */}
          <div className="max-w-4xl mx-auto mt-24">
            <div className="relative rounded-3xl gradient-ink px-8 py-14 text-center overflow-hidden">
              <div
                aria-hidden
                className="absolute inset-0 opacity-40"
                style={{ background: "var(--gradient-mesh)" }}
              />
              <div className="relative">
                <h2 className="font-display text-3xl md:text-4xl font-semibold text-white mb-3">
                  Ten minutes to a clearer account.
                </h2>
                <p className="text-white/60 max-w-md mx-auto mb-8">
                  Connect with LinkedIn OAuth and your campaigns, creatives, and
                  audiences are on screen — nothing to install.
                </p>
                <Button variant="hero" size="lg" onClick={initiateAuth} disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Linkedin className="h-5 w-5" />
                  )}
                  Get started free
                </Button>
              </div>
            </div>
          </div>
        </main>

        {/* ── Footer ──────────────────────────────────────────── */}
        <footer className="border-t border-border/50">
          <div className="container mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md gradient-primary flex items-center justify-center">
                <Linkedin className="h-3 w-3 text-primary-foreground" />
              </div>
              <span className="font-semibold text-foreground">LinkedIn Ads Manager</span>
            </div>
            <p>Your LinkedIn API credentials are securely stored and encrypted.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

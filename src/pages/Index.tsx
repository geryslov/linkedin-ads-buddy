import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLinkedInAuth } from "@/hooks/useLinkedInAuth";
import { Button } from "@/components/ui/button";
import { Linkedin, BarChart3, Users, Megaphone, ArrowRight, Loader2 } from "lucide-react";

export default function Index() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, initiateAuth } = useLinkedInAuth();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, navigate]);

  const features = [
    {
      icon: BarChart3,
      title: "Campaign Analytics",
      description: "Track impressions, clicks, conversions and ROI in real-time",
    },
    {
      icon: Megaphone,
      title: "Campaign Management",
      description: "Create, pause, and optimize campaigns from one dashboard",
    },
    {
      icon: Users,
      title: "Audience Insights",
      description: "Analyze and manage your targeting audiences",
    },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background glow */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{ background: 'var(--gradient-glow)' }}
      />
      
      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-border/50 backdrop-blur-sm">
          <div className="container mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg gradient-primary">
                <Linkedin className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg">LinkedIn Ads Manager</span>
            </div>
          </div>
        </header>

        {/* Hero */}
        <main className="container mx-auto px-6 py-20">
          <div className="max-w-4xl mx-auto text-center space-y-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse-subtle" />
              Connected to LinkedIn Marketing API
            </div>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight">
              Manage Your
              <span className="text-gradient block">LinkedIn Ads</span>
              With Ease
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              A powerful dashboard to view analytics, manage campaigns, 
              and gain audience insights from your LinkedIn advertising.
            </p>

            <div className="pt-4">
              <Button 
                variant="hero" 
                size="xl"
                onClick={initiateAuth}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Linkedin className="h-5 w-5" />
                )}
                Connect LinkedIn Account
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mt-24 max-w-5xl mx-auto">
            {features.map((feature, i) => (
              <div 
                key={feature.title}
                className="glass rounded-2xl p-8 animate-slide-up hover:border-primary/30 transition-colors"
                style={{ animationDelay: `${300 + i * 100}ms` }}
              >
                <div className="p-3 rounded-xl bg-primary/10 w-fit mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border/50 mt-20">
          <div className="container mx-auto px-6 py-8 text-center text-muted-foreground text-sm">
            <p>Your LinkedIn API credentials are securely stored and encrypted.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

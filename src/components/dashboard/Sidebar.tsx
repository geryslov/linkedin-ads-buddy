import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Megaphone,
  Users,
  BarChart3,
  FileBarChart,
  LogOut,
  Linkedin,
  Shield,
  Crown,
  Building2,
  Wallet,
  ImageIcon,
  TrendingUp,
  LineChart,
  Crosshair,
  BookOpen,
  Tags,
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  profileName?: string;
  isAdmin?: boolean;
}

const navItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
  { id: "audiences", label: "Audiences", icon: Users },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "budget_pacing", label: "Budget Pacing", icon: Wallet },
  { id: "company_timeline", label: "Company Timeline", icon: Building2 },
  { id: "creatives", label: "Creatives", icon: ImageIcon },
  { id: "creative_reports", label: "Creative Reports", icon: TrendingUp },
  { id: "campaign_reports", label: "Campaign Reports", icon: LineChart },
  { id: "reports", label: "Reports", icon: FileBarChart },
  { id: "title_checker", label: "Title Checker", icon: Crown },
  { id: "influence_matcher", label: "Influence Matcher", icon: Crosshair },
  { id: "standardized_titles", label: "Titles", icon: BookOpen },
  { id: "name_report", label: "Name Report", icon: Tags },
];

export function Sidebar({ activeTab, onTabChange, onLogout, profileName, isAdmin }: SidebarProps) {
  const navigate = useNavigate();
  
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg gradient-primary">
            <Linkedin className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg">LinkedIn Ads</h1>
            <p className="text-xs text-muted-foreground">Manager</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3 h-11",
              activeTab === item.id && "bg-sidebar-accent text-sidebar-accent-foreground"
            )}
            onClick={() => onTabChange(item.id)}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Button>
        ))}
        
        {isAdmin && (
          <>
            <div className="my-4 border-t border-sidebar-border" />
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-11 text-primary"
              onClick={() => navigate('/admin')}
            >
              <Shield className="h-5 w-5" />
              Admin Panel
            </Button>
          </>
        )}
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-2">
        {profileName && (
          <div className="px-3 py-2 text-sm">
            <p className="text-muted-foreground text-xs">Connected as</p>
            <p className="font-medium truncate">{profileName}</p>
          </div>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
          onClick={onLogout}
        >
          <LogOut className="h-5 w-5" />
          Disconnect
        </Button>
      </div>
    </aside>
  );
}

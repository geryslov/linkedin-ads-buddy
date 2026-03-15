import { useState, useEffect } from "react";
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
  Grid3x3,
  ClipboardList,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  profileName?: string;
  isAdmin?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  id: string;
  label?: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    id: "main",
    items: [
      { id: "overview", label: "Overview", icon: LayoutDashboard },
    ],
  },
  {
    id: "campaigns",
    label: "Campaigns",
    items: [
      { id: "campaigns", label: "Campaigns", icon: Megaphone },
      { id: "budget_pacing", label: "Budget Pacing", icon: Wallet },
      { id: "creatives", label: "Creatives", icon: ImageIcon },
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    items: [
      { id: "analytics", label: "Analytics", icon: BarChart3 },
      { id: "campaign_reports", label: "Campaign Reports", icon: LineChart },
      { id: "creative_reports", label: "Creative Reports", icon: TrendingUp },
      { id: "reports", label: "Reports", icon: FileBarChart },
      { id: "conv_breakdown", label: "Conv. Breakdown", icon: Grid3x3 },
    ],
  },
  {
    id: "audience",
    label: "Audience",
    items: [
      { id: "audiences", label: "Audiences", icon: Users },
      { id: "company_timeline", label: "Company Timeline", icon: Building2 },
      { id: "influence_matcher", label: "Influence Matcher", icon: Crosshair },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    items: [
      { id: "title_checker", label: "Title Checker", icon: Crown },
      { id: "standardized_titles", label: "Titles", icon: BookOpen },
      { id: "name_report", label: "Name Report", icon: Tags },
    ],
  },
  {
    id: "leads",
    label: "Leads",
    items: [
      { id: "forms_leads", label: "Forms & Leads", icon: ClipboardList },
    ],
  },
];

function getActiveGroupId(activeTab: string): string {
  for (const group of navGroups) {
    if (group.items.some((item) => item.id === activeTab)) {
      return group.id;
    }
  }
  return "main";
}

export function Sidebar({
  activeTab,
  onTabChange,
  onLogout,
  profileName,
  isAdmin,
  collapsed = false,
  onCollapsedChange,
}: SidebarProps) {
  const navigate = useNavigate();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Auto-expand the group containing the active tab
  useEffect(() => {
    const activeGroupId = getActiveGroupId(activeTab);
    setCollapsedGroups((prev) => ({ ...prev, [activeGroupId]: false }));
  }, [activeTab]);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={cn("border-b border-sidebar-border flex items-center", collapsed ? "p-3 justify-center" : "p-6")}>
        {collapsed ? (
          <div className="p-2 rounded-lg gradient-primary">
            <Linkedin className="h-5 w-5 text-primary-foreground" />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg gradient-primary">
              <Linkedin className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg">LinkedIn Ads</h1>
              <p className="text-xs text-muted-foreground">Manager</p>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className={cn("flex-1 overflow-y-auto space-y-1", collapsed ? "p-2" : "p-3")}>
        {navGroups.map((group) => {
          const isGroupCollapsed = collapsedGroups[group.id] ?? false;
          const hasLabel = !!group.label;

          return (
            <div key={group.id}>
              {/* Group header — hidden in icon-only mode */}
              {hasLabel && !collapsed && (
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-3 py-1.5 mb-0.5 rounded-md text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors cursor-pointer"
                >
                  {group.label}
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform duration-200",
                      isGroupCollapsed && "-rotate-90"
                    )}
                  />
                </button>
              )}

              {/* Group items — always show in collapsed mode (icons only) */}
              {(!isGroupCollapsed || collapsed) && (
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <Button
                      key={item.id}
                      variant="ghost"
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "w-full h-9 text-sm font-normal",
                        collapsed ? "justify-center px-0" : "justify-start gap-3",
                        !collapsed && hasLabel && "pl-4",
                        activeTab === item.id
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => onTabChange(item.id)}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && item.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Admin */}
        {isAdmin && (
          <div className="pt-2">
            <div className="border-t border-sidebar-border mb-2" />
            <Button
              variant="ghost"
              title={collapsed ? "Admin Panel" : undefined}
              className={cn(
                "w-full h-9 text-sm font-normal text-primary hover:text-primary",
                collapsed ? "justify-center px-0" : "justify-start gap-3"
              )}
              onClick={() => navigate("/admin")}
            >
              <Shield className="h-4 w-4 shrink-0" />
              {!collapsed && "Admin Panel"}
            </Button>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className={cn("border-t border-sidebar-border space-y-1", collapsed ? "p-2" : "p-4")}>
        {/* Collapse toggle */}
        {onCollapsedChange && (
          <Button
            variant="ghost"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "w-full h-9 text-sm text-muted-foreground hover:text-foreground",
              collapsed ? "justify-center px-0" : "justify-start gap-3"
            )}
            onClick={() => onCollapsedChange(!collapsed)}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4 shrink-0" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4 shrink-0" />
                Collapse
              </>
            )}
          </Button>
        )}

        {!collapsed && profileName && (
          <div className="px-3 py-2 text-sm">
            <p className="text-muted-foreground text-xs">Connected as</p>
            <p className="font-medium truncate">{profileName}</p>
          </div>
        )}
        <Button
          variant="ghost"
          title={collapsed ? "Disconnect" : undefined}
          className={cn(
            "w-full text-sm text-muted-foreground hover:text-destructive",
            collapsed ? "justify-center px-0 h-9" : "justify-start gap-3"
          )}
          onClick={onLogout}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && "Disconnect"}
        </Button>
      </div>
    </aside>
  );
}

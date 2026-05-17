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
  CalendarRange,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  Sparkles,
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
      { id: "weekly_report", label: "Weekly Report", icon: CalendarRange },
      { id: "conv_breakdown", label: "Conv. Breakdown", icon: Grid3x3 },
      { id: "activity_report", label: "Activity Report", icon: ClipboardList },
      { id: "creative_analyzer", label: "Creative Analyzer", icon: Sparkles },
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
      { id: "lead_records", label: "Lead Records", icon: Users },
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
      {/* ── Logo ──────────────────────────────────────────────── */}
      <div className={cn(
        "border-b border-sidebar-border flex items-center",
        collapsed ? "p-3 justify-center h-14" : "px-5 py-4 h-14"
      )}>
        {collapsed ? (
          <div className="p-1.5 rounded-md gradient-primary">
            <Linkedin className="h-4 w-4 text-primary-foreground" />
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md gradient-primary shrink-0">
              <Linkedin className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm leading-tight truncate">LinkedIn Ads</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Manager</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Nav ───────────────────────────────────────────────── */}
      <nav className={cn("flex-1 overflow-y-auto py-3", collapsed ? "px-2" : "px-3")}>
        {navGroups.map((group, groupIdx) => {
          const isGroupCollapsed = collapsedGroups[group.id] ?? false;
          const hasLabel = !!group.label;

          return (
            <div key={group.id} className={groupIdx > 0 ? "mt-1" : ""}>
              {/* Group header — hidden in icon-only mode */}
              {hasLabel && !collapsed && (
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-2 py-1 mb-0.5 rounded text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 hover:text-muted-foreground transition-colors cursor-pointer select-none"
                >
                  {group.label}
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 transition-transform duration-200",
                      isGroupCollapsed && "-rotate-90"
                    )}
                  />
                </button>
              )}

              {/* Group items */}
              {(!isGroupCollapsed || collapsed) && (
                <div className="space-y-px">
                  {group.items.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <div key={item.id} className="relative">
                        {/* Active left-border indicator */}
                        {isActive && !collapsed && (
                          <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r bg-primary z-10" />
                        )}
                        <Button
                          variant="ghost"
                          title={collapsed ? item.label : undefined}
                          className={cn(
                            "w-full h-8 text-sm rounded-md transition-colors duration-150",
                            collapsed ? "justify-center px-0" : "justify-start gap-2.5",
                            !collapsed && hasLabel && "pl-3.5",
                            isActive
                              ? "bg-primary/8 text-primary font-medium hover:bg-primary/10"
                              : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                          )}
                          style={isActive ? { background: "hsl(221 83% 53% / 0.08)" } : undefined}
                          onClick={() => onTabChange(item.id)}
                        >
                          <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
                          {!collapsed && item.label}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Separator after each group (except last) */}
              {hasLabel && !collapsed && groupIdx < navGroups.length - 1 && (
                <div className="mt-1 border-b border-sidebar-border/50" />
              )}
            </div>
          );
        })}

        {/* Social Listener */}
        <div className="mt-2 pt-2 border-t border-sidebar-border">
          <Button
            variant="ghost"
            title={collapsed ? "Social Listener" : undefined}
            className={cn(
              "w-full h-8 text-sm font-normal text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20",
              collapsed ? "justify-center px-0" : "justify-start gap-2.5"
            )}
            onClick={() => navigate("/social-listener")}
          >
            <Radio className="h-4 w-4 shrink-0" />
            {!collapsed && "Social Listener"}
          </Button>
        </div>

        {/* Admin */}
        {isAdmin && (
          <div className="mt-2 pt-2 border-t border-sidebar-border">
            <Button
              variant="ghost"
              title={collapsed ? "Admin Panel" : undefined}
              className={cn(
                "w-full h-8 text-sm font-normal text-primary hover:text-primary hover:bg-primary/8",
                collapsed ? "justify-center px-0" : "justify-start gap-2.5"
              )}
              onClick={() => navigate("/admin")}
            >
              <Shield className="h-4 w-4 shrink-0" />
              {!collapsed && "Admin Panel"}
            </Button>
          </div>
        )}
      </nav>

      {/* ── Footer ────────────────────────────────────────────── */}
      <div className={cn(
        "border-t border-sidebar-border space-y-0.5",
        collapsed ? "p-2" : "p-3"
      )}>
        {/* Collapse toggle */}
        {onCollapsedChange && (
          <Button
            variant="ghost"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "w-full h-8 text-xs text-muted-foreground hover:text-foreground",
              collapsed ? "justify-center px-0" : "justify-start gap-2.5"
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
          <div className="px-2 py-1.5 rounded-md bg-muted/50">
            <p className="text-[11px] text-muted-foreground">Connected as</p>
            <p className="text-xs font-medium truncate">{profileName}</p>
          </div>
        )}

        <Button
          variant="ghost"
          title={collapsed ? "Disconnect" : undefined}
          className={cn(
            "w-full text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/8",
            collapsed ? "justify-center px-0 h-8" : "justify-start gap-2.5 h-8"
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

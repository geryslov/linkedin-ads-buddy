import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
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
  Target,
  Layers,
  Bot,
  CopyPlus,
  Pencil,
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  profileName?: string;
  isAdmin?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onConnectClaude?: () => void;
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

export const navGroups: NavGroup[] = [
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
    id: "bulk_editing",
    label: "Bulk Editing",
    items: [
      { id: "bulk_add_creatives", label: "Add Ads to Campaigns", icon: CopyPlus },
      { id: "campaign_editor", label: "Campaign Editor", icon: Pencil },
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
      { id: "lead_gen_analyzer", label: "Lead Gen Analyzer", icon: Target },
      { id: "account_health", label: "Account Health", icon: Shield },
      { id: "segmentation", label: "Segmentation", icon: Layers },
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

/* Sidebar nav row — colors come from the sidebar token set. */
function NavRow({
  icon: Icon,
  label,
  active,
  collapsed,
  onClick,
  className,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      title={collapsed ? label : undefined}
      onClick={onClick}
      className={cn(
        "relative w-full flex items-center rounded-md h-8 text-[13px] transition-colors duration-150 outline-none",
        "focus-visible:ring-2 focus-visible:ring-sidebar-ring/60",
        collapsed ? "justify-center px-0" : "gap-2.5 px-2.5",
        active
          ? "bg-primary/[0.08] text-sidebar-primary font-medium"
          : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent",
        className
      )}
    >
      {active && !collapsed && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-sidebar-primary" />
      )}
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          active ? "text-sidebar-primary" : "text-sidebar-foreground/70"
        )}
      />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

export function Sidebar({
  activeTab,
  onTabChange,
  onLogout,
  profileName,
  isAdmin,
  collapsed = false,
  onCollapsedChange,
  onConnectClaude,
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

  const initials = profileName
    ? profileName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
    : null;

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 z-30",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* ── Brand ─────────────────────────────────────────────── */}
      <div
        className={cn(
          "border-b border-sidebar-border flex items-center shrink-0",
          collapsed ? "p-3 justify-center h-14" : "px-4 h-14"
        )}
      >
        {collapsed ? (
          <div className="h-8 w-8 rounded-lg gradient-primary glow-primary flex items-center justify-center">
            <Linkedin className="h-4 w-4 text-primary-foreground" />
          </div>
        ) : (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg gradient-primary glow-primary flex items-center justify-center shrink-0">
              <Linkedin className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-[13px] leading-tight truncate text-foreground">
                LinkedIn Ads
              </p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground leading-tight">
                Manager
              </p>
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
            <div key={group.id} className={groupIdx > 0 ? "mt-3" : ""}>
              {hasLabel && !collapsed && (
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-2.5 py-1 mb-0.5 rounded text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer select-none"
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

              {(!isGroupCollapsed || collapsed) && (
                <div className="space-y-px">
                  {group.items.map((item) => (
                    <NavRow
                      key={item.id}
                      icon={item.icon}
                      label={item.label}
                      active={activeTab === item.id}
                      collapsed={collapsed}
                      onClick={() => onTabChange(item.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Social Listener */}
        <div className="mt-3 pt-3 border-t border-sidebar-border">
          <NavRow
            icon={Radio}
            label="Social Listener"
            collapsed={collapsed}
            onClick={() => navigate("/social-listener")}
            className="text-emerald-600 hover:!text-emerald-700 hover:!bg-emerald-50 [&>svg]:text-emerald-600"
          />
        </div>

        {/* Admin */}
        {isAdmin && (
          <div className="mt-2">
            <NavRow
              icon={Shield}
              label="Admin Panel"
              collapsed={collapsed}
              onClick={() => navigate("/admin")}
              className="text-sidebar-primary hover:text-sidebar-primary [&>svg]:text-sidebar-primary"
            />
          </div>
        )}
      </nav>

      {/* ── Footer ────────────────────────────────────────────── */}
      <div className={cn("border-t border-sidebar-border shrink-0", collapsed ? "p-2 space-y-1" : "p-3 space-y-1")}>
        {onConnectClaude && (
          <NavRow
            icon={Bot}
            label="Connect to Claude"
            collapsed={collapsed}
            onClick={onConnectClaude}
          />
        )}

        <NavRow
          icon={LogOut}
          label="Disconnect"
          collapsed={collapsed}
          onClick={onLogout}
          className="hover:!text-destructive hover:!bg-destructive/[0.06] [&:hover>svg]:text-destructive"
        />

        {onCollapsedChange && (
          <NavRow
            icon={collapsed ? PanelLeftOpen : PanelLeftClose}
            label="Collapse"
            collapsed={collapsed}
            onClick={() => onCollapsedChange(!collapsed)}
          />
        )}

        {!collapsed && profileName && (
          <div className="flex items-center gap-2.5 px-2 pt-2 mt-1 border-t border-sidebar-border">
            <div className="h-7 w-7 rounded-full gradient-primary flex items-center justify-center text-[10px] font-bold text-white shrink-0">
              {initials}
            </div>
            <div className="min-w-0 py-1.5">
              <p className="text-[10px] text-muted-foreground leading-tight">Connected as</p>
              <p className="text-xs font-medium text-foreground truncate leading-tight">
                {profileName}
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

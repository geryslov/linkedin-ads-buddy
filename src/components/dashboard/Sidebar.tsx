import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Megaphone,
  Users,
  BarChart3,
  FileBarChart,
  LogOut,
  Linkedin,
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  profileName?: string;
}

const navItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
  { id: "audiences", label: "Audiences", icon: Users },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "reports", label: "Reports", icon: FileBarChart },
];

export function Sidebar({ activeTab, onTabChange, onLogout, profileName }: SidebarProps) {
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

      <nav className="flex-1 p-4 space-y-1">
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

import { useState, useMemo } from "react";
import { Campaign } from "@/hooks/useLinkedInAds";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoreHorizontal, Play, Pause, Archive, Filter, Megaphone, AlignJustify, AlignCenter } from "lucide-react";
import { cn } from "@/lib/utils";

interface CampaignTableProps {
  campaigns: Campaign[];
  onStatusChange: (campaignId: string, status: string) => void;
  isLoading?: boolean;
}

type Density = "compact" | "default";

export function CampaignTable({ campaigns, onStatusChange, isLoading }: CampaignTableProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [density, setDensity] = useState<Density>("default");

  const uniqueTypes = useMemo(() => {
    const types = new Set(campaigns.map((c) => c.type));
    return Array.from(types);
  }, [campaigns]);

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((campaign) => {
      const matchesStatus = statusFilter === "all" || campaign.status === statusFilter;
      const matchesType = typeFilter === "all" || campaign.type === typeFilter;
      return matchesStatus && matchesType;
    });
  }, [campaigns, statusFilter, typeFilter]);

  // U3 — Color-coded status badges with dot indicator
  const getStatusBadge = (status: string) => {
    const config: Record<string, { dot: string; label: string; className: string }> = {
      ACTIVE:   { dot: "bg-success",          label: "Active",   className: "bg-success/10 text-success border-success/20" },
      PAUSED:   { dot: "bg-warning",           label: "Paused",   className: "bg-warning/10 text-warning border-warning/20" },
      ARCHIVED: { dot: "bg-muted-foreground",  label: "Archived", className: "bg-muted text-muted-foreground border-border" },
      DRAFT:    { dot: "bg-blue-400",          label: "Draft",    className: "bg-blue-50 text-blue-600 border-blue-200" },
    };
    const s = config[status] ?? config.ARCHIVED;
    return (
      <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border", s.className)}>
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", s.dot)} />
        {s.label}
      </span>
    );
  };

  const formatBudget = (budget?: { amount: string; currencyCode: string }) => {
    if (!budget) return "—";
    return `${budget.currencyCode} ${parseFloat(budget.amount).toLocaleString()}`;
  };

  // U4 — Proper empty state with icon + guidance
  if (campaigns.length === 0) {
    return (
      <div className="glass rounded-xl p-16 text-center animate-fade-in">
        <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <Megaphone className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-foreground mb-1">No campaigns yet</h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          Create your first campaign in LinkedIn Campaign Manager and it will appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-slide-up" style={{ animationDelay: '200ms' }}>
      {/* Filters + density toggle */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span className="text-sm font-medium">Filters:</span>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] bg-card border-border">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="PAUSED">Paused</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px] bg-card border-border">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">All Types</SelectItem>
            {uniqueTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(statusFilter !== "all" || typeFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter("all");
              setTypeFilter("all");
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            Clear filters
          </Button>
        )}

        {/* U7 — Row density toggle */}
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-border p-0.5">
          <button
            onClick={() => setDensity("compact")}
            title="Compact"
            className={cn(
              "p-1.5 rounded-md transition-colors",
              density === "compact" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <AlignJustify className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setDensity("default")}
            title="Default"
            className={cn(
              "p-1.5 rounded-md transition-colors",
              density === "default" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <AlignCenter className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground font-semibold">Campaign Name</TableHead>
              <TableHead className="text-muted-foreground font-semibold">Status</TableHead>
              <TableHead className="text-muted-foreground font-semibold">Type</TableHead>
              <TableHead className="text-muted-foreground font-semibold">Daily Budget</TableHead>
              <TableHead className="text-muted-foreground font-semibold">Total Budget</TableHead>
              <TableHead className="text-muted-foreground font-semibold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCampaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No campaigns match the selected filters
                </TableCell>
              </TableRow>
            ) : (
              filteredCampaigns.map((campaign) => (
                <TableRow
                  key={campaign.id}
                  className={cn(
                    "border-border hover:bg-secondary/30 cursor-pointer",
                    density === "compact" ? "[&>td]:py-1.5" : "[&>td]:py-3"
                  )}
                >
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                  <TableCell className="text-muted-foreground">{campaign.type}</TableCell>
                  <TableCell className="tabular-nums">{formatBudget(campaign.dailyBudget)}</TableCell>
                  <TableCell className="tabular-nums">{formatBudget(campaign.totalBudget)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={isLoading}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-card border-border">
                        <DropdownMenuItem 
                          onClick={() => onStatusChange(campaign.id, 'ACTIVE')}
                          className="gap-2"
                        >
                          <Play className="h-4 w-4" /> Activate
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => onStatusChange(campaign.id, 'PAUSED')}
                          className="gap-2"
                        >
                          <Pause className="h-4 w-4" /> Pause
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => onStatusChange(campaign.id, 'ARCHIVED')}
                          className="gap-2 text-muted-foreground"
                        >
                          <Archive className="h-4 w-4" /> Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

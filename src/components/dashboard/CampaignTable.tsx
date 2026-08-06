import { useState, useMemo } from "react";
import { Campaign } from "@/hooks/useLinkedInAds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { WidgetCard, EmptyState, StatusPill, SegmentedControl } from "./widgets";
import {
  MoreHorizontal,
  Play,
  Pause,
  Archive,
  Megaphone,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CampaignTableProps {
  campaigns: Campaign[];
  onStatusChange: (campaignId: string, status: string) => void;
  isLoading?: boolean;
}

type SortKey = "name" | "status" | "dailyBudget" | "totalBudget";
type SortDir = "asc" | "desc";

const STATUS_TONE: Record<string, { tone: "success" | "warning" | "info" | "neutral"; label: string }> = {
  ACTIVE: { tone: "success", label: "Active" },
  PAUSED: { tone: "warning", label: "Paused" },
  DRAFT: { tone: "info", label: "Draft" },
  ARCHIVED: { tone: "neutral", label: "Archived" },
};

const budgetValue = (b?: { amount: string }) => (b ? parseFloat(b.amount) : -1);

export function CampaignTable({ campaigns, onStatusChange, isLoading }: CampaignTableProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const uniqueTypes = useMemo(() => {
    const types = new Set(campaigns.map((c) => c.type));
    return Array.from(types);
  }, [campaigns]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: campaigns.length };
    for (const c of campaigns) counts[c.status] = (counts[c.status] ?? 0) + 1;
    return counts;
  }, [campaigns]);

  const filteredCampaigns = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = campaigns.filter((campaign) => {
      const matchesStatus = statusFilter === "all" || campaign.status === statusFilter;
      const matchesType = typeFilter === "all" || campaign.type === typeFilter;
      const matchesSearch = !q || campaign.name.toLowerCase().includes(q);
      return matchesStatus && matchesType && matchesSearch;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      switch (sortKey) {
        case "name":
          return dir * a.name.localeCompare(b.name);
        case "status":
          return dir * a.status.localeCompare(b.status);
        case "dailyBudget":
          return dir * (budgetValue(a.dailyBudget) - budgetValue(b.dailyBudget));
        case "totalBudget":
          return dir * (budgetValue(a.totalBudget) - budgetValue(b.totalBudget));
      }
    });
  }, [campaigns, statusFilter, typeFilter, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "status" ? "asc" : "desc");
    }
  };

  const SortHeader = ({ label, k, align }: { label: string; k: SortKey; align?: "right" }) => (
    <button
      onClick={() => toggleSort(k)}
      className={cn(
        "inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground transition-colors",
        align === "right" && "flex-row-reverse"
      )}
    >
      {label}
      {sortKey === k ? (
        sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );

  const formatBudget = (budget?: { amount: string; currencyCode: string }) => {
    if (!budget) return <span className="text-muted-foreground/50">—</span>;
    return `${budget.currencyCode} ${parseFloat(budget.amount).toLocaleString()}`;
  };

  if (campaigns.length === 0) {
    return (
      <WidgetCard noPadding>
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description="Create your first campaign in LinkedIn Campaign Manager and it will appear here automatically."
        />
      </WidgetCard>
    );
  }

  return (
    <WidgetCard
      noPadding
      className="animate-slide-up"
      title="Campaigns"
      subtitle={`${filteredCampaigns.length} of ${campaigns.length} shown`}
      toolbar={
        <>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search campaigns…"
              className="h-8 w-[200px] pl-8 text-sm"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-[150px] text-sm bg-card border-border">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">All types</SelectItem>
              {uniqueTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      }
    >
      {/* Status chips with live counts */}
      <div className="px-5 pb-3">
        <SegmentedControl
          size="sm"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "all", label: <>All <span className="opacity-60">{statusCounts.all}</span></> },
            { value: "ACTIVE", label: <>Active <span className="opacity-60">{statusCounts.ACTIVE ?? 0}</span></> },
            { value: "PAUSED", label: <>Paused <span className="opacity-60">{statusCounts.PAUSED ?? 0}</span></> },
            { value: "DRAFT", label: <>Draft <span className="opacity-60">{statusCounts.DRAFT ?? 0}</span></> },
            { value: "ARCHIVED", label: <>Archived <span className="opacity-60">{statusCounts.ARCHIVED ?? 0}</span></> },
          ]}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent bg-secondary/40">
            <TableHead><SortHeader label="Campaign" k="name" /></TableHead>
            <TableHead><SortHeader label="Status" k="status" /></TableHead>
            <TableHead className="text-muted-foreground font-semibold">Type</TableHead>
            <TableHead className="text-right"><SortHeader label="Daily budget" k="dailyBudget" align="right" /></TableHead>
            <TableHead className="text-right"><SortHeader label="Total budget" k="totalBudget" align="right" /></TableHead>
            <TableHead className="text-right text-muted-foreground font-semibold w-[90px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredCampaigns.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                No campaigns match your filters
              </TableCell>
            </TableRow>
          ) : (
            filteredCampaigns.map((campaign) => {
              const s = STATUS_TONE[campaign.status] ?? STATUS_TONE.ARCHIVED;
              const isActive = campaign.status === "ACTIVE";
              const canToggle = campaign.status === "ACTIVE" || campaign.status === "PAUSED";
              return (
                <TableRow
                  key={campaign.id}
                  className="group border-border hover:bg-secondary/30 [&>td]:py-2.5"
                >
                  <TableCell className="font-medium max-w-[380px]">
                    <span className="block truncate" title={campaign.name}>{campaign.name}</span>
                  </TableCell>
                  <TableCell><StatusPill tone={s.tone} label={s.label} /></TableCell>
                  <TableCell className="text-muted-foreground text-xs">{campaign.type}</TableCell>
                  <TableCell className="tabular-nums text-right">{formatBudget(campaign.dailyBudget)}</TableCell>
                  <TableCell className="tabular-nums text-right">{formatBudget(campaign.totalBudget)}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-0.5">
                      {/* One-click pause/activate — visible on hover */}
                      {canToggle && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          disabled={isLoading}
                          title={isActive ? "Pause campaign" : "Activate campaign"}
                          onClick={() => onStatusChange(campaign.id, isActive ? "PAUSED" : "ACTIVE")}
                        >
                          {isActive
                            ? <Pause className="h-3.5 w-3.5" />
                            : <Play className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isLoading}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-card border-border">
                          <DropdownMenuItem onClick={() => onStatusChange(campaign.id, "ACTIVE")} className="gap-2">
                            <Play className="h-4 w-4" /> Activate
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onStatusChange(campaign.id, "PAUSED")} className="gap-2">
                            <Pause className="h-4 w-4" /> Pause
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onStatusChange(campaign.id, "ARCHIVED")}
                            className="gap-2 text-muted-foreground"
                          >
                            <Archive className="h-4 w-4" /> Archive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </WidgetCard>
  );
}

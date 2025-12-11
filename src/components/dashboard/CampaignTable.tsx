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
import { MoreHorizontal, Play, Pause, Archive, Filter } from "lucide-react";

interface CampaignTableProps {
  campaigns: Campaign[];
  onStatusChange: (campaignId: string, status: string) => void;
  isLoading?: boolean;
}

export function CampaignTable({ campaigns, onStatusChange, isLoading }: CampaignTableProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      ACTIVE: "default",
      PAUSED: "secondary",
      ARCHIVED: "outline",
      DRAFT: "outline",
    };
    
    return (
      <Badge 
        variant={variants[status] || "secondary"}
        className={status === "ACTIVE" ? "bg-success text-success-foreground" : ""}
      >
        {status}
      </Badge>
    );
  };

  const formatBudget = (budget?: { amount: string; currencyCode: string }) => {
    if (!budget) return "—";
    return `${budget.currencyCode} ${parseFloat(budget.amount).toLocaleString()}`;
  };

  if (campaigns.length === 0) {
    return (
      <div className="glass rounded-xl p-12 text-center animate-fade-in">
        <p className="text-muted-foreground">No campaigns found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-slide-up" style={{ animationDelay: '200ms' }}>
      {/* Filters */}
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
                <TableRow key={campaign.id} className="border-border hover:bg-secondary/30">
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                  <TableCell className="text-muted-foreground">{campaign.type}</TableCell>
                  <TableCell>{formatBudget(campaign.dailyBudget)}</TableCell>
                  <TableCell>{formatBudget(campaign.totalBudget)}</TableCell>
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

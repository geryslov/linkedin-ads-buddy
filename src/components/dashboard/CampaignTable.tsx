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
import { MoreHorizontal, Play, Pause, Archive } from "lucide-react";

interface CampaignTableProps {
  campaigns: Campaign[];
  onStatusChange: (campaignId: string, status: string) => void;
  isLoading?: boolean;
}

export function CampaignTable({ campaigns, onStatusChange, isLoading }: CampaignTableProps) {
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
    <div className="glass rounded-xl overflow-hidden animate-slide-up" style={{ animationDelay: '200ms' }}>
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
          {campaigns.map((campaign) => (
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

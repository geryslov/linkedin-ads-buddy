import { AdAccount } from "@/hooks/useLinkedInAds";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Star, AlertCircle, Shield, Eye, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AccountSelectorProps {
  accounts: AdAccount[];
  selectedAccount: string | null;
  onSelect: (accountId: string) => void;
  onSetDefault?: (accountId: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  lastSyncedAt?: string | null;
}

// Role display configuration
const roleConfig: Record<string, { label: string; icon: typeof Shield }> = {
  ACCOUNT_MANAGER: { label: "Account Manager", icon: Shield },
  CAMPAIGN_MANAGER: { label: "Campaign Manager", icon: Shield },
  CREATIVE_MANAGER: { label: "Creative Manager", icon: Shield },
  VIEWER: { label: "Viewer", icon: Eye },
  BILLING_ADMIN: { label: "Billing Admin", icon: Shield },
  DIRECT_ACCESS: { label: "Direct Access", icon: Shield },
  UNKNOWN: { label: "Unknown Role", icon: AlertCircle },
};

export function AccountSelector({
  accounts,
  selectedAccount,
  onSelect,
  onSetDefault,
  onRefresh,
  isRefreshing,
  lastSyncedAt,
}: AccountSelectorProps) {
  // Empty state — compact pill that fits the header bar
  if (accounts.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <div
          className="flex items-center gap-2 h-8 px-3 rounded-full bg-warning/[0.08] text-warning text-xs font-medium"
          title="Request access from your LinkedIn Campaign Manager, then refresh."
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          No ad accounts
        </div>
        {onRefresh && (
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh accounts from LinkedIn"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        )}
      </div>
    );
  }

  const selectedAccountData = accounts.find((a) => a.id === selectedAccount);

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedAccount || undefined} onValueChange={onSelect}>
        <SelectTrigger className="h-8 w-[280px] text-sm bg-card border-border rounded-lg">
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <SelectValue placeholder="Select ad account" />
          </div>
        </SelectTrigger>
        <SelectContent className="bg-card border-border">
          {accounts.map((account) => {
            const accRoleInfo = roleConfig[account.userRole] || roleConfig.UNKNOWN;
            const RoleIcon = accRoleInfo.icon;

            return (
              <SelectItem key={account.id} value={account.id}>
                <div className="flex items-center gap-2 w-full">
                  {account.isDefault && (
                    <Star className="h-3 w-3 text-warning fill-current shrink-0" />
                  )}
                  <span className="truncate">{account.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    ({account.currency})
                  </span>
                  <Badge
                    variant="outline"
                    className={`ml-auto text-xs shrink-0 ${
                      account.canWrite
                        ? "bg-success/[0.08] text-success border-success/20"
                        : "bg-warning/[0.08] text-warning border-warning/20"
                    }`}
                  >
                    <RoleIcon className="h-3 w-3 mr-1" />
                    {accRoleInfo.label}
                  </Badge>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {/* Default star: filled if default, click to set otherwise */}
      {selectedAccount && selectedAccountData && (
        selectedAccountData.isDefault ? (
          <div className="h-8 w-8 flex items-center justify-center" title="Default account">
            <Star className="h-3.5 w-3.5 text-warning fill-current" />
          </div>
        ) : (
          onSetDefault && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onSetDefault(selectedAccount)}
              title="Set as default account"
            >
              <Star className="h-3.5 w-3.5 text-muted-foreground hover:text-warning" />
            </Button>
          )
        )
      )}

      {/* Refresh */}
      {onRefresh && (
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={onRefresh}
          disabled={isRefreshing}
          title={
            lastSyncedAt
              ? `Last synced ${formatDistanceToNow(new Date(lastSyncedAt))} ago. Click to refresh.`
              : "Refresh accounts from LinkedIn"
          }
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
        </Button>
      )}
    </div>
  );
}

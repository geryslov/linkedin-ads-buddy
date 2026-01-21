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
import { Building2, Star, AlertCircle, Shield, Eye } from "lucide-react";

interface AccountSelectorProps {
  accounts: AdAccount[];
  selectedAccount: string | null;
  onSelect: (accountId: string) => void;
  onSetDefault?: (accountId: string) => void;
}

// Role display configuration
const roleConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: typeof Shield }> = {
  ACCOUNT_MANAGER: { label: "Account Manager", variant: "default", icon: Shield },
  CAMPAIGN_MANAGER: { label: "Campaign Manager", variant: "default", icon: Shield },
  CREATIVE_MANAGER: { label: "Creative Manager", variant: "default", icon: Shield },
  VIEWER: { label: "Viewer", variant: "secondary", icon: Eye },
  BILLING_ADMIN: { label: "Billing Admin", variant: "outline", icon: Shield },
  DIRECT_ACCESS: { label: "Direct Access", variant: "outline", icon: Shield },
  UNKNOWN: { label: "Unknown Role", variant: "outline", icon: AlertCircle },
};

export function AccountSelector({ 
  accounts, 
  selectedAccount, 
  onSelect,
  onSetDefault 
}: AccountSelectorProps) {
  // Empty state - no accounts found
  if (accounts.length === 0) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary/50 border border-border">
        <AlertCircle className="h-5 w-5 text-muted-foreground" />
        <div className="text-sm">
          <p className="font-medium">No Ad Accounts Found</p>
          <p className="text-muted-foreground">
            Request access from your LinkedIn Campaign Manager
          </p>
        </div>
      </div>
    );
  }

  const selectedAccountData = accounts.find(a => a.id === selectedAccount);
  const roleInfo = selectedAccountData 
    ? roleConfig[selectedAccountData.userRole] || roleConfig.UNKNOWN
    : null;

  return (
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-secondary">
        <Building2 className="h-4 w-4 text-muted-foreground" />
      </div>
      <Select value={selectedAccount || undefined} onValueChange={onSelect}>
        <SelectTrigger className="w-[320px] bg-secondary border-border">
          <SelectValue placeholder="Select ad account" />
        </SelectTrigger>
        <SelectContent className="bg-card border-border">
          {accounts.map((account) => {
            const accRoleInfo = roleConfig[account.userRole] || roleConfig.UNKNOWN;
            const RoleIcon = accRoleInfo.icon;
            
            return (
              <SelectItem key={account.id} value={account.id}>
                <div className="flex items-center gap-2 w-full">
                  {account.isDefault && (
                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" />
                  )}
                  <span className="truncate">{account.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    ({account.currency})
                  </span>
                  <Badge 
                    variant={accRoleInfo.variant} 
                    className={`ml-auto text-xs shrink-0 ${
                      account.canWrite 
                        ? 'bg-green-600/20 text-green-400 border-green-600/30' 
                        : 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30'
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
      
      {/* Set as Default Button */}
      {selectedAccount && onSetDefault && selectedAccountData && !selectedAccountData.isDefault && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onSetDefault(selectedAccount)}
          title="Set as default account"
          className="hover:bg-yellow-500/10"
        >
          <Star className="h-4 w-4 text-muted-foreground hover:text-yellow-500" />
        </Button>
      )}
      
      {/* Show filled star if current account is default */}
      {selectedAccountData?.isDefault && (
        <div className="p-2" title="Default account">
          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
        </div>
      )}
    </div>
  );
}

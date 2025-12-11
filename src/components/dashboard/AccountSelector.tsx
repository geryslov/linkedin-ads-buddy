import { AdAccount } from "@/hooks/useLinkedInAds";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";

interface AccountSelectorProps {
  accounts: AdAccount[];
  selectedAccount: string | null;
  onSelect: (accountId: string) => void;
}

export function AccountSelector({ accounts, selectedAccount, onSelect }: AccountSelectorProps) {
  if (accounts.length === 0) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-secondary">
        <Building2 className="h-4 w-4 text-muted-foreground" />
      </div>
      <Select value={selectedAccount || undefined} onValueChange={onSelect}>
        <SelectTrigger className="w-[280px] bg-secondary border-border">
          <SelectValue placeholder="Select ad account" />
        </SelectTrigger>
        <SelectContent className="bg-card border-border">
          {accounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              <div className="flex items-center gap-2">
                <span>{account.name}</span>
                <span className="text-xs text-muted-foreground">({account.currency})</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

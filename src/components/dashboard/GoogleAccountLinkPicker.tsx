import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Link2, Link2Off, Loader2 } from 'lucide-react';
import type { GoogleAdsAccount, GoogleAdsLink } from '@/hooks/useGoogleAdsLinks';

interface Props {
  accountId: string;
  link?: GoogleAdsLink;
  accounts: GoogleAdsAccount[];
  isLoading: boolean;
  error?: string | null;
  onOpen: () => void;
  onSelect: (account: GoogleAdsAccount | null) => void | Promise<void>;
  compact?: boolean;
}

/** Choose which Google Ads account a client's spend should be pulled from. */
export function GoogleAccountLinkPicker({
  accountId, link, accounts, isLoading, error, onOpen, onSelect, compact,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = search.trim()
    ? accounts.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase()) || a.id.includes(search.replace(/\D/g, '')))
    : accounts;

  const choose = async (account: GoogleAdsAccount | null) => {
    setSaving(true);
    await onSelect(account);
    setSaving(false);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => { setOpen(next); if (next) onOpen(); }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={compact ? 'h-6 px-1.5 text-[11px] text-muted-foreground hover:text-primary' : 'h-8 text-xs'}
        >
          {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Link2 className="mr-1 h-3 w-3" />}
          {link ? (link.googleCustomerName || link.googleCustomerId) : 'Link Google account'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3">
        <p className="text-xs font-semibold text-foreground">Google Ads account</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Pick the account whose spend should show for this client.
        </p>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search accounts"
          className="mt-2 h-8 text-xs"
        />
        <div className="mt-2 max-h-64 overflow-y-auto">
          {isLoading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
              Loading accounts…
            </p>
          ) : error ? (
            <p className="py-4 text-center text-xs text-destructive">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No accounts found</p>
          ) : (
            filtered.map((a) => (
              <button
                key={a.id}
                onClick={() => choose(a)}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-secondary ${
                  link?.googleCustomerId === a.id ? 'bg-secondary' : ''
                }`}
              >
                <span className="min-w-0 truncate text-foreground">{a.name}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">{a.id}</span>
              </button>
            ))
          )}
        </div>
        {link && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 h-7 w-full text-[11px] text-muted-foreground"
            onClick={() => choose(null)}
          >
            <Link2Off className="mr-1 h-3 w-3" /> Unlink, go back to typing spend
          </Button>
        )}
        <input type="hidden" value={accountId} readOnly />
      </PopoverContent>
    </Popover>
  );
}

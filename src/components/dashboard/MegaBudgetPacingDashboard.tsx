import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useMegaBudgetPacing, AccountPacingSummary } from "@/hooks/useMegaBudgetPacing";
import { WidgetCard, EmptyState, StatusPill } from "./widgets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { AlertTriangle, ArrowUpDown, Save, X, Pencil } from "lucide-react";
import { toast } from "sonner";

interface Props {
  accessToken: string | null;
  adAccounts: Array<{ id: string; name?: string | null }>;
}

type SortKey = "name" | "linkedin" | "google" | "additional";
type BudgetField = "amount" | "googleAmount" | "additionalAmount" | "googleSpend" | "additionalSpend";

type ChannelStatus = "overspend" | "underspend" | "on_track" | "no_budget";

export function MegaBudgetPacingDashboard({ accessToken, adAccounts }: Props) {
  const { data, isLoading, error, fetchAll, saveBudget } = useMegaBudgetPacing(accessToken);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const accountIds = useMemo(() => adAccounts.map(a => a.id), [adAccounts]);
  const accountIdsKey = accountIds.join(",");

  const fetchAllRef = useRef(fetchAll);
  fetchAllRef.current = fetchAll;

  useEffect(() => {
    if (accessToken && accountIds.length > 0) {
      fetchAllRef.current(accountIds);
    }
  }, [accessToken, accountIdsKey]);

  const nameMap = new Map(adAccounts.map(a => [a.id, a.name || a.id]));

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const sorted = [...data].sort((a, b) => {
    const dir = sortAsc ? 1 : -1;
    const channelUsage = (spent: number, budget: number) => budget > 0 ? spent / budget : -1;
    switch (sortKey) {
      case "name": return dir * (nameMap.get(a.accountId) || "").localeCompare(nameMap.get(b.accountId) || "");
      case "linkedin": return dir * (channelUsage(a.spent, a.budget) - channelUsage(b.spent, b.budget));
      case "google": return dir * (channelUsage(a.googleSpent || 0, a.googleBudget || 0) - channelUsage(b.googleSpent || 0, b.googleBudget || 0));
      case "additional": return dir * (channelUsage(a.additionalSpent || 0, a.additionalBudget || 0) - channelUsage(b.additionalSpent || 0, b.additionalBudget || 0));
      default: return 0;
    }
  });

  const handleSaveField = useCallback(async (accountId: string, field: BudgetField) => {
    const value = parseFloat(editValue);
    if (isNaN(value) || value < 0) { toast.error("Enter a valid amount"); return; }
    const ok = await saveBudget(accountId, { [field]: value });
    if (ok) {
      toast.success("Saved");
      setEditingCell(null);
      fetchAll(adAccounts.map(a => a.id));
    } else {
      toast.error("Failed to save");
    }
  }, [editValue, saveBudget, fetchAll, adAccounts]);

  const channelPacing = (s: AccountPacingSummary, spent: number, budget: number) => {
    const usedPercent = budget > 0 ? (spent / budget) * 100 : 0;
    const daysElapsed = Math.max(1, s.daysInMonth - s.daysRemaining);
    const expectedPercent = (daysElapsed / s.daysInMonth) * 100;
    const pacingPercent = expectedPercent > 0 ? (usedPercent / expectedPercent) * 100 : 0;
    const status: ChannelStatus = budget === 0
      ? "no_budget"
      : pacingPercent > 110
        ? "overspend"
        : pacingPercent < 90
          ? "underspend"
          : "on_track";
    return { usedPercent, pacingPercent, status };
  };

  const statusBadge = (status: ChannelStatus) => {
    if (status === "no_budget") return <StatusPill tone="neutral" label="No budget" />;
    if (status === "overspend") return <StatusPill tone="danger" label="Over" />;
    if (status === "underspend") return <StatusPill tone="warning" label="Under" />;
    return <StatusPill tone="success" label="On track" />;
  };

  const editableCell = (s: AccountPacingSummary, field: BudgetField, value: number) => {
    const cellId = `${s.accountId}|${field}`;
    if (editingCell === cellId) {
      return (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            className="w-24 h-8 text-sm"
            onKeyDown={e => e.key === "Enter" && handleSaveField(s.accountId, field)}
            autoFocus
          />
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSaveField(s.accountId, field)}>
            <Save className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingCell(null)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      );
    }
    return (
      <button
        className="flex items-center gap-1 hover:text-primary transition-colors tabular-nums"
        onClick={() => { setEditingCell(cellId); setEditValue(String(value || "")); }}
      >
        {value > 0 ? `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "Set"}
        <Pencil className="h-3 w-3 opacity-50" />
      </button>
    );
  };

  const channelCell = (
    s: AccountPacingSummary,
    label: string,
    spent: number,
    budget: number,
    budgetField: BudgetField,
    spendField?: BudgetField,
  ) => {
    const pacing = channelPacing(s, spent, budget);
    return (
      <div className="min-w-[210px] space-y-2 py-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
          {statusBadge(pacing.status)}
        </div>
        <div className="flex items-center justify-between gap-3 text-xs">
          <div className="min-w-0">
            <span className="text-muted-foreground">Spent </span>
            {spendField ? editableCell(s, spendField, spent) : (
              <span className="font-semibold tabular-nums">${spent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            )}
          </div>
          <div className="flex items-center gap-1 whitespace-nowrap">
            <span className="text-muted-foreground">Budget</span>
            {editableCell(s, budgetField, budget)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Progress value={Math.min(pacing.usedPercent, 100)} className="h-1.5 flex-1" />
          <span className="w-9 text-right text-xs font-semibold tabular-nums text-foreground">
            {budget > 0 ? `${pacing.usedPercent.toFixed(0)}%` : "—"}
          </span>
        </div>
        {budget > 0 && (
          <p className="text-[11px] text-muted-foreground tabular-nums">
            Pacing {pacing.pacingPercent.toFixed(0)}% of month target
          </p>
        )}
      </div>
    );
  };

  if (error) {
    return (
      <WidgetCard noPadding>
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load budget pacing"
          description={error}
          action={
            <Button variant="outline" size="sm" onClick={() => fetchAll(adAccounts.map(a => a.id))}>
              Retry
            </Button>
          }
        />
      </WidgetCard>
    );
  }

  return (
    <div>
      <WidgetCard noPadding title="Account pacing by channel" subtitle="LinkedIn, Google and Additional spend against budget for every account">
        {isLoading ? (
          <div className="p-5"><Skeleton className="h-64 bg-secondary rounded-lg" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => handleSort("name")}>
                  <span className="flex items-center gap-1">Account <ArrowUpDown className="h-3 w-3" /></span>
                </TableHead>
                <TableHead className="cursor-pointer w-[27%]" onClick={() => handleSort("linkedin")}>
                  <span className="flex items-center gap-1">LinkedIn <ArrowUpDown className="h-3 w-3" /></span>
                </TableHead>
                <TableHead className="cursor-pointer w-[27%]" onClick={() => handleSort("google")}>
                  <span className="flex items-center gap-1">Google <ArrowUpDown className="h-3 w-3" /></span>
                </TableHead>
                <TableHead className="cursor-pointer w-[27%]" onClick={() => handleSort("additional")}>
                  <span className="flex items-center gap-1">Additional <ArrowUpDown className="h-3 w-3" /></span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                    No accounts found
                  </TableCell>
                </TableRow>
              ) : sorted.map((s) => (
                <TableRow key={s.accountId}>
                  <TableCell className="align-top">
                    <p className="font-semibold text-foreground">{nameMap.get(s.accountId) || s.accountId}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{s.daysRemaining} days left</p>
                  </TableCell>
                  <TableCell className="align-top">{channelCell(s, "LinkedIn", s.spent, s.budget, "amount")}</TableCell>
                  <TableCell className="align-top">{channelCell(s, "Google", s.googleSpent || 0, s.googleBudget || 0, "googleAmount", "googleSpend")}</TableCell>
                  <TableCell className="align-top">{channelCell(s, "Additional", s.additionalSpent || 0, s.additionalBudget || 0, "additionalAmount", "additionalSpend")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </WidgetCard>
    </div>
  );
}

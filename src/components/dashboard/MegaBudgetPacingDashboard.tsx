import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useMegaBudgetPacing, AccountPacingSummary } from "@/hooks/useMegaBudgetPacing";
import { MetricCard } from "./MetricCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  DollarSign, Wallet, TrendingUp, AlertTriangle, CheckCircle2, ArrowUpDown, Save, X, Pencil
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  accessToken: string | null;
  adAccounts: Array<{ id: string; name?: string | null }>;
}

type SortKey = "name" | "pacingStatus" | "pacingPercent" | "spent" | "budget";

const statusOrder: Record<string, number> = { overspend: 0, underspend: 1, on_track: 2 };

export function MegaBudgetPacingDashboard({ accessToken, adAccounts }: Props) {
  const { data, isLoading, error, fetchAll, saveBudget, aggregates } = useMegaBudgetPacing(accessToken);
  const [sortKey, setSortKey] = useState<SortKey>("pacingStatus");
  const [sortAsc, setSortAsc] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
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
    switch (sortKey) {
      case "name": return dir * (nameMap.get(a.accountId) || "").localeCompare(nameMap.get(b.accountId) || "");
      case "pacingStatus": return dir * ((statusOrder[a.pacingStatus] ?? 3) - (statusOrder[b.pacingStatus] ?? 3));
      case "pacingPercent": return dir * (a.pacingPercent - b.pacingPercent);
      case "spent": return dir * (a.spent - b.spent);
      case "budget": return dir * (a.budget - b.budget);
      default: return 0;
    }
  });

  const handleSaveBudget = useCallback(async (accountId: string) => {
    const amount = parseFloat(editValue);
    if (isNaN(amount) || amount < 0) { toast.error("Enter a valid budget"); return; }
    const ok = await saveBudget(accountId, amount);
    if (ok) {
      toast.success("Budget saved");
      setEditingId(null);
      fetchAll(adAccounts.map(a => a.id));
    } else {
      toast.error("Failed to save budget");
    }
  }, [editValue, saveBudget, fetchAll, adAccounts]);

  const pacingColor = (s: AccountPacingSummary) => {
    if (s.budget === 0) return "text-muted-foreground";
    if (s.pacingStatus === "overspend") return "text-destructive";
    if (s.pacingStatus === "underspend") return "text-yellow-500";
    return "text-green-500";
  };

  const statusBadge = (s: AccountPacingSummary) => {
    if (s.budget === 0) return <Badge variant="secondary">No Budget</Badge>;
    if (s.pacingStatus === "overspend") return <Badge variant="destructive">Over</Badge>;
    if (s.pacingStatus === "underspend") return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">Under</Badge>;
    return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">On Track</Badge>;
  };

  if (error) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
        <p className="text-destructive">{error}</p>
        <Button variant="outline" className="mt-4" onClick={() => fetchAll(adAccounts.map(a => a.id))}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl bg-secondary" />)
        ) : (
          <>
            <MetricCard title="Total Budget" value={`$${aggregates.totalBudget.toLocaleString()}`} icon={Wallet} delay={0} />
            <MetricCard title="Total Spent" value={`$${aggregates.totalSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={DollarSign} delay={50} />
            <MetricCard
              title="Overall Pacing"
              value={`${aggregates.overallPacing.toFixed(1)}%`}
              icon={TrendingUp}
              delay={100}
            />
            <MetricCard
              title="Account Status"
              value={`${aggregates.onTrack} on track`}
              change={aggregates.over > 0 ? `${aggregates.over} over · ${aggregates.under} under` : `${aggregates.under} under`}
              changeType={aggregates.over > 0 ? "negative" : "neutral"}
              icon={CheckCircle2}
              delay={150}
            />
          </>
        )}
      </div>

      {/* Account Table */}
      <div className="glass rounded-xl overflow-hidden animate-slide-up" style={{ animationDelay: "200ms" }}>
        {isLoading ? (
          <div className="p-8"><Skeleton className="h-64 bg-secondary rounded-lg" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => handleSort("name")}>
                  <span className="flex items-center gap-1">Account <ArrowUpDown className="h-3 w-3" /></span>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort("budget")}>
                  <span className="flex items-center gap-1">Budget <ArrowUpDown className="h-3 w-3" /></span>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort("spent")}>
                  <span className="flex items-center gap-1">Spent <ArrowUpDown className="h-3 w-3" /></span>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort("pacingStatus")}>
                  <span className="flex items-center gap-1">Status <ArrowUpDown className="h-3 w-3" /></span>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort("pacingPercent")}>
                  <span className="flex items-center gap-1">Pacing <ArrowUpDown className="h-3 w-3" /></span>
                </TableHead>
                <TableHead>Projected</TableHead>
                <TableHead>Days Left</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    No accounts found
                  </TableCell>
                </TableRow>
              ) : sorted.map((s) => (
                <TableRow key={s.accountId}>
                  <TableCell className="font-medium">{nameMap.get(s.accountId) || s.accountId}</TableCell>
                  <TableCell>
                    {editingId === s.accountId ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          className="w-24 h-8 text-sm"
                          onKeyDown={e => e.key === "Enter" && handleSaveBudget(s.accountId)}
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSaveBudget(s.accountId)}>
                          <Save className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        className="flex items-center gap-1 hover:text-primary transition-colors"
                        onClick={() => { setEditingId(s.accountId); setEditValue(String(s.budget || "")); }}
                      >
                        {s.budget > 0 ? `$${s.budget.toLocaleString()}` : "Set budget"}
                        <Pencil className="h-3 w-3 opacity-50" />
                      </button>
                    )}
                  </TableCell>
                  <TableCell>${s.spent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                  <TableCell>{statusBadge(s)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <Progress value={Math.min(s.pacingPercent, 150) / 1.5} className="h-2 w-16" />
                      <span className={`text-sm font-medium ${pacingColor(s)}`}>
                        {s.budget > 0 ? `${s.pacingPercent}%` : "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>${s.projected.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                  <TableCell>{s.daysRemaining}d</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState, useMemo } from "react";
import { useAccountBudgets } from "@/hooks/useAccountBudgets";
import { useMultiAccountSpend, AccountSpend } from "@/hooks/useMultiAccountSpend";
import { calculatePace, formatCurrency } from "@/lib/paceCalculations";
import { PaceBadge } from "./PaceBadge";
import { BudgetProgressBar } from "./BudgetProgressBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X, Pencil, DollarSign, TrendingUp, Calendar } from "lucide-react";
import { format, startOfMonth, subMonths, addMonths } from "date-fns";

interface AdAccount {
  id: string;
  name: string;
  currency?: string;
}

interface AccountsOverviewProps {
  accessToken: string | null;
  adAccounts: AdAccount[];
}

export function AccountsOverview({ accessToken, adAccounts }: AccountsOverviewProps) {
  const [selectedMonth, setSelectedMonth] = useState<Date>(startOfMonth(new Date()));
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editBudgetValue, setEditBudgetValue] = useState<string>("");

  const { budgets, isLoading: budgetsLoading, fetchBudgets, upsertBudget, getBudgetForAccount } = useAccountBudgets();
  const { accountSpends, isLoading: spendsLoading, fetchAllAccountSpends, totals } = useMultiAccountSpend(accessToken);

  // Generate month options (last 6 months + current + next month)
  const monthOptions = useMemo(() => {
    const options = [];
    for (let i = -6; i <= 1; i++) {
      const month = i === 0 ? startOfMonth(new Date()) : (i < 0 ? subMonths(startOfMonth(new Date()), -i) : addMonths(startOfMonth(new Date()), i));
      options.push({
        value: format(month, 'yyyy-MM-dd'),
        label: format(month, 'MMMM yyyy'),
        date: month,
      });
    }
    return options;
  }, []);

  // Fetch data when accounts or month changes
  useEffect(() => {
    if (adAccounts.length > 0) {
      fetchBudgets(selectedMonth);
      fetchAllAccountSpends(adAccounts, selectedMonth);
    }
  }, [adAccounts, selectedMonth, fetchBudgets, fetchAllAccountSpends]);

  const handleStartEdit = (accountId: string) => {
    const budget = getBudgetForAccount(accountId);
    setEditBudgetValue(budget?.budget_amount?.toString() || "");
    setEditingAccountId(accountId);
  };

  const handleSaveBudget = async (accountId: string, currency: string) => {
    const amount = parseFloat(editBudgetValue);
    if (!isNaN(amount) && amount >= 0) {
      await upsertBudget(accountId, amount, selectedMonth, currency);
    }
    setEditingAccountId(null);
    setEditBudgetValue("");
  };

  const handleCancelEdit = () => {
    setEditingAccountId(null);
    setEditBudgetValue("");
  };

  // Calculate totals with pace
  const totalBudget = budgets.reduce((sum, b) => sum + Number(b.budget_amount), 0);
  const totalPace = calculatePace(totals.spend, totalBudget, selectedMonth);

  const isLoading = budgetsLoading || spendsLoading;

  // Merge account data with spend and budget
  const accountRows = adAccounts.map((account) => {
    const spend = accountSpends.find(s => s.accountId === account.id);
    const budget = getBudgetForAccount(account.id);
    const pace = calculatePace(
      spend?.spend || 0,
      budget?.budget_amount,
      selectedMonth
    );
    
    return {
      ...account,
      spend: spend?.spend || 0,
      currency: spend?.currency || budget?.currency || 'USD',
      budget: budget?.budget_amount,
      pace,
    };
  });

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Monthly Budget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalBudget)}
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              MTD Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totals.spend)}
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Projected Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalPace.projectedSpend)}
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overall Pace
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <PaceBadge status={totalPace.status} pacePercentage={totalPace.pacePercentage} />
            </div>
            {totalBudget > 0 && (
              <BudgetProgressBar 
                percentUsed={totalPace.percentUsed}
                expectedPercent={(totalPace.daysElapsed / totalPace.totalDaysInMonth) * 100}
                status={totalPace.status}
                className="mt-2"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Month Selector */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Month:</span>
        </div>
        <Select 
          value={format(selectedMonth, 'yyyy-MM-dd')}
          onValueChange={(value) => {
            const option = monthOptions.find(o => o.value === value);
            if (option) setSelectedMonth(option.date);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Accounts Table */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Account Budgets & Spend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && adAccounts.length === 0 ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : adAccounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No ad accounts found. Please connect your LinkedIn account.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Account</TableHead>
                  <TableHead className="text-right">MTD Spend</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead>Pace</TableHead>
                  <TableHead className="text-right">Projected</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="w-[200px]">Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accountRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right">
                      {spendsLoading ? (
                        <Skeleton className="h-4 w-20 ml-auto" />
                      ) : (
                        formatCurrency(row.spend, row.currency)
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingAccountId === row.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <Input
                            type="number"
                            value={editBudgetValue}
                            onChange={(e) => setEditBudgetValue(e.target.value)}
                            className="w-28 h-8 text-right"
                            placeholder="0"
                            min="0"
                            autoFocus
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-green-600"
                            onClick={() => handleSaveBudget(row.id, row.currency)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground"
                            onClick={handleCancelEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <span>
                            {row.budget 
                              ? formatCurrency(row.budget, row.currency)
                              : <span className="text-muted-foreground">—</span>
                            }
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => handleStartEdit(row.id)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <PaceBadge 
                        status={row.pace.status} 
                        pacePercentage={row.pace.pacePercentage}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {row.pace.status === 'no_budget' ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        formatCurrency(row.pace.projectedSpend, row.currency)
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.pace.status === 'no_budget' ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        formatCurrency(row.pace.remainingBudget, row.currency)
                      )}
                    </TableCell>
                    <TableCell>
                      {row.pace.status !== 'no_budget' && (
                        <div className="flex items-center gap-2">
                          <BudgetProgressBar
                            percentUsed={row.pace.percentUsed}
                            expectedPercent={(row.pace.daysElapsed / row.pace.totalDaysInMonth) * 100}
                            status={row.pace.status}
                            className="flex-1"
                          />
                          <span className="text-xs text-muted-foreground w-10 text-right">
                            {Math.round(row.pace.percentUsed)}%
                          </span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

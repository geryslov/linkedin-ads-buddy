import { getDaysInMonth, getDate, startOfMonth, differenceInDays } from 'date-fns';

export type PaceStatus = 'on_track' | 'overspending' | 'underspending' | 'no_budget';

export interface PaceCalculation {
  mtdSpend: number;
  budget: number;
  daysElapsed: number;
  totalDaysInMonth: number;
  dailyBudget: number;
  expectedSpend: number;
  projectedSpend: number;
  pacePercentage: number;
  status: PaceStatus;
  remainingBudget: number;
  remainingDailyBudget: number;
  percentUsed: number;
}

export function calculatePace(
  mtdSpend: number,
  budget: number | undefined,
  month?: Date
): PaceCalculation {
  const targetMonth = month || new Date();
  const now = new Date();
  
  // Check if we're looking at the current month
  const isCurrentMonth = 
    targetMonth.getMonth() === now.getMonth() && 
    targetMonth.getFullYear() === now.getFullYear();
  
  const totalDaysInMonth = getDaysInMonth(targetMonth);
  
  // For current month, use days elapsed; for past months, use total days
  const daysElapsed = isCurrentMonth 
    ? Math.max(1, getDate(now)) 
    : totalDaysInMonth;
  
  const remainingDays = Math.max(0, totalDaysInMonth - daysElapsed);
  
  // Handle no budget case
  if (!budget || budget <= 0) {
    return {
      mtdSpend,
      budget: 0,
      daysElapsed,
      totalDaysInMonth,
      dailyBudget: 0,
      expectedSpend: 0,
      projectedSpend: daysElapsed > 0 ? (mtdSpend / daysElapsed) * totalDaysInMonth : 0,
      pacePercentage: 0,
      status: 'no_budget',
      remainingBudget: 0,
      remainingDailyBudget: 0,
      percentUsed: 0,
    };
  }
  
  const dailyBudget = budget / totalDaysInMonth;
  const expectedSpend = dailyBudget * daysElapsed;
  const projectedSpend = daysElapsed > 0 
    ? (mtdSpend / daysElapsed) * totalDaysInMonth 
    : 0;
  
  // Pace percentage: how much of expected spend we've used
  const pacePercentage = expectedSpend > 0 
    ? (mtdSpend / expectedSpend) * 100 
    : 0;
  
  const remainingBudget = Math.max(0, budget - mtdSpend);
  const remainingDailyBudget = remainingDays > 0 
    ? remainingBudget / remainingDays 
    : 0;
  
  const percentUsed = budget > 0 ? (mtdSpend / budget) * 100 : 0;
  
  // Determine status based on pace
  // On track: 85% - 115% of expected pace
  // Overspending: > 115% of expected pace
  // Underspending: < 85% of expected pace
  let status: PaceStatus;
  if (pacePercentage > 115) {
    status = 'overspending';
  } else if (pacePercentage < 85) {
    status = 'underspending';
  } else {
    status = 'on_track';
  }
  
  return {
    mtdSpend,
    budget,
    daysElapsed,
    totalDaysInMonth,
    dailyBudget,
    expectedSpend,
    projectedSpend,
    pacePercentage,
    status,
    remainingBudget,
    remainingDailyBudget,
    percentUsed,
  };
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCurrencyPrecise(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAccountBalances, money, fiscalYearStart, fiscalYearLabel } from '@/lib/accounting';

// Period presets: month = current calendar month, fy = Indian fiscal year (Apr–Mar), all = everything
function periodRange(period: string): { from: Date | null; to: Date | null; label: string } {
  const now = new Date();
  if (period === 'month') {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: null,
      label: now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    };
  }
  if (period === 'fy') {
    return { from: fiscalYearStart(now), to: null, label: fiscalYearLabel(now) };
  }
  return { from: null, to: null, label: 'All time' };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = ['month', 'fy', 'all'].includes(searchParams.get('period') || '')
      ? (searchParams.get('period') as 'month' | 'fy' | 'all')
      : 'all';

    const range = periodRange(period);
    const rangeWhere = {
      isPosted: true,
      ...(range.from || range.to
        ? {
            date: {
              ...(range.from ? { gte: range.from } : {}),
              ...(range.to ? { lt: range.to } : {}),
            },
          }
        : {}),
    };

    // All-time balances (assets/liabilities are point-in-time, always full history)
    const balances = await getAccountBalances();
    const byType = (t: string) => balances.filter((b) => b.type === t && b.isActive);
    const sum = (t: string) => money(byType(t).reduce((s, b) => s + b.balance, 0));

    // Period-scoped revenue & expenses
    const periodEntries = await db.journalEntry.findMany({
      where: rangeWhere,
      include: { lines: { include: { account: true } } },
    });
    let periodRevenue = 0;
    let periodExpenses = 0;
    for (const e of periodEntries) {
      for (const l of e.lines) {
        if (l.account.type === 'REVENUE') periodRevenue += l.credit - l.debit;
        if (l.account.type === 'EXPENSE') periodExpenses += l.debit - l.credit;
      }
    }
    periodRevenue = money(periodRevenue);
    periodExpenses = money(periodExpenses);
    const periodNetIncome = money(periodRevenue - periodExpenses);

    const totalAssets = sum('ASSET');
    const totalLiabilities = sum('LIABILITY');
    const cash = money(
      (balances.find((b) => b.code === '1010')?.balance ?? 0) +
        (balances.find((b) => b.code === '1000')?.balance ?? 0)
    );
    const gstPayable = money(balances.find((b) => b.code === '2200')?.balance ?? 0);

    // last 6 months revenue & expenses trend (independent of period selection)
    const now = new Date();
    const months: { key: string; label: string; revenue: number; expenses: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const entries = await db.journalEntry.findMany({
        where: { date: { gte: start, lt: end }, isPosted: true },
        include: { lines: { include: { account: true } } },
      });
      let revenue = 0;
      let expenses = 0;
      for (const e of entries) {
        for (const l of e.lines) {
          if (l.account.type === 'REVENUE') revenue += l.credit - l.debit;
          if (l.account.type === 'EXPENSE') expenses += l.debit - l.credit;
        }
      }
      months.push({
        key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
        label: start.toLocaleDateString('en-IN', { month: 'short' }),
        revenue: money(revenue),
        expenses: money(expenses),
      });
    }

    // plan mix by active customers
    const customers = await db.customer.findMany();
    const planMix = ['SILVER', 'GOLD', 'DIAMOND'].map((p) => ({
      plan: p,
      count: customers.filter((c) => c.planType === p && c.status === 'ACTIVE').length,
    }));

    // customers by city
    const cityCounts: Record<string, number> = {};
    for (const c of customers) cityCounts[c.city] = (cityCounts[c.city] || 0) + 1;
    const cityMix = Object.entries(cityCounts)
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count);

    // expense breakdown within the selected period
    const expenseRows = await db.expense.findMany({
      where:
        range.from || range.to
          ? {
              date: {
                ...(range.from ? { gte: range.from } : {}),
                ...(range.to ? { lt: range.to } : {}),
              },
            }
          : undefined,
    });
    const categoryTotals: Record<string, number> = {};
    for (const e of expenseRows) {
      categoryTotals[e.category] = money((categoryTotals[e.category] || 0) + e.amount);
    }
    const expenseByCategory = Object.entries(categoryTotals)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    // operations stats
    const [activePlans, activePlacements, availableHelpers, salesInPeriod, helpersAll, placementsAll, planSalesAll] =
      await Promise.all([
        db.customer.count({ where: { status: 'ACTIVE', planType: { not: null } } }),
        db.placement.count({ where: { status: 'ACTIVE' } }),
        db.helper.count({ where: { status: 'VERIFIED' } }),
        db.planSale.count({
          where: {
            saleDate: {
              ...(range.from ? { gte: range.from } : {}),
              ...(range.to ? { lt: range.to } : {}),
            },
          },
        }),
        db.helper.findMany({ select: { city: true } }),
        db.placement.findMany({
          where: { status: 'ACTIVE' },
          include: { customer: { select: { city: true } } },
        }),
        db.planSale.findMany({
          where: { isRefunded: false },
          include: { customer: { select: { city: true } } },
        }),
      ]);

    // city operations — households, helpers, active placements & plan revenue per city
    const cityOpsMap: Record<string, { city: string; customers: number; helpers: number; placements: number; revenue: number }> = {};
    const cityEntry = (city: string) => (cityOpsMap[city] ??= { city, customers: 0, helpers: 0, placements: 0, revenue: 0 });
    for (const c of customers) cityEntry(c.city).customers += 1;
    for (const h of helpersAll) cityEntry(h.city).helpers += 1;
    for (const p of placementsAll) cityEntry(p.customer.city).placements += 1;
    for (const s of planSalesAll) cityEntry(s.customer.city).revenue = money(cityEntry(s.customer.city).revenue + s.feeAmount);
    const cityOps = Object.values(cityOpsMap)
      .map((o) => ({ ...o, revenue: money(o.revenue) }))
      .sort((a, b) => b.revenue - a.revenue);

    // recent ledger — cash impact per entry with a running balance walk-back from current cash
    const recentEntries = await db.journalEntry.findMany({
      where: { isPosted: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 9,
      include: { lines: { include: { account: true } } },
    });
    let runningBalance = cash;
    const recentTransactions = recentEntries.map((e) => {
      const cashDelta = money(
        e.lines.reduce(
          (s, l) => (l.account.code === '1000' || l.account.code === '1010' ? s + l.debit - l.credit : s),
          0
        )
      );
      const balanceAfter = runningBalance;
      runningBalance = money(runningBalance - cashDelta);
      return {
        id: e.id,
        entryNumber: e.entryNumber,
        date: e.date,
        memo: e.memo,
        source: e.source,
        amount: money(e.lines.reduce((s, l) => s + l.debit, 0)),
        cashDelta,
        balance: balanceAfter,
      };
    });

    return NextResponse.json({
      period: { key: period, label: range.label },
      kpis: {
        cash,
        totalRevenue: periodRevenue,
        totalExpenses: periodExpenses,
        netIncome: periodNetIncome,
        totalAssets,
        totalLiabilities,
        totalEquity: money(totalAssets - totalLiabilities),
        gstPayable,
        activePlans,
        activePlacements,
        availableHelpers,
        customerCount: customers.length,
        salesInPeriod,
        monthRevenue: months[months.length - 1]?.revenue ?? 0,
      },
      months,
      planMix,
      cityMix,
      cityOps,
      expenseByCategory,
      recentTransactions,
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAccountBalances, money } from '@/lib/accounting';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'pl'; // pl | balance | trial

    const balances = await getAccountBalances();

    if (type === 'trial') {
      // Trial balance: all accounts with debit/credit columns
      const rows = balances
        .filter((b) => b.debitTotal !== 0 || b.creditTotal !== 0)
        .map((b) => ({
          code: b.code,
          name: b.name,
          type: b.type,
          debit: b.debitTotal > b.creditTotal ? money(b.debitTotal - b.creditTotal) : 0,
          credit: b.creditTotal > b.debitTotal ? money(b.creditTotal - b.debitTotal) : 0,
          rawDebit: b.debitTotal,
          rawCredit: b.creditTotal,
        }));
      const totalDebit = money(rows.reduce((s, r) => s + r.debit, 0));
      const totalCredit = money(rows.reduce((s, r) => s + r.credit, 0));
      return NextResponse.json({
        type: 'trial',
        rows,
        totalDebit,
        totalCredit,
        balanced: Math.abs(totalDebit - totalCredit) < 0.01,
      });
    }

    if (type === 'balance') {
      const assets = balances.filter((b) => b.type === 'ASSET');
      const liabilities = balances.filter((b) => b.type === 'LIABILITY');
      const equity = balances.filter((b) => b.type === 'EQUITY');
      const revenue = balances.filter((b) => b.type === 'REVENUE');
      const expenses = balances.filter((b) => b.type === 'EXPENSE');

      const totalRevenue = money(revenue.reduce((s, b) => s + b.balance, 0));
      const totalExpenses = money(expenses.reduce((s, b) => s + b.balance, 0));
      const netIncome = money(totalRevenue - totalExpenses);

      // contra accounts: equity balances are already "normal side" positive
      const totalAssets = money(assets.reduce((s, b) => s + b.balance, 0));
      const totalLiabilities = money(liabilities.reduce((s, b) => s + b.balance, 0));
      const totalEquity = money(equity.reduce((s, b) => s + b.balance, 0) + netIncome);

      return NextResponse.json({
        type: 'balance',
        assets: assets.filter((a) => a.balance !== 0 || a.isActive),
        liabilities: liabilities.filter((a) => a.balance !== 0 || a.isActive),
        equity,
        netIncome,
        totalRevenue,
        totalExpenses,
        totalAssets,
        totalLiabilities,
        totalEquity,
        balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
      });
    }

    // default: profit & loss (optionally restricted to a date range)
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const from = fromParam ? new Date(`${fromParam}T00:00:00`) : undefined;
    const to = toParam ? new Date(`${toParam}T00:00:00`) : undefined;
    to?.setDate(to.getDate() + 1); // inclusive end date

    const rangeBalances =
      from || to ? await getAccountBalances({ from, to }) : balances;

    const revenue = rangeBalances.filter((b) => b.type === 'REVENUE' && b.balance !== 0);
    const expenses = rangeBalances.filter((b) => b.type === 'EXPENSE' && b.balance !== 0);
    const totalRevenue = money(revenue.reduce((s, b) => s + b.balance, 0));
    const totalExpenses = money(expenses.reduce((s, b) => s + b.balance, 0));
    const netIncome = money(totalRevenue - totalExpenses);

    // monthly breakdown — inside the range if given (max 12 months), else last 6
    const months: { label: string; revenue: number; expenses: number; net: number }[] = [];
    let cursor: Date;
    let monthCount: number;
    if (from || to) {
      const rangeStart = from ?? new Date(to!.getFullYear(), to!.getMonth() - 11, 1);
      const rangeEnd = to ?? new Date();
      monthCount = Math.min(
        12,
        (rangeEnd.getFullYear() - rangeStart.getFullYear()) * 12 +
          (rangeEnd.getMonth() - rangeStart.getMonth()) +
          1
      );
      cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
    } else {
      monthCount = 6;
      const now = new Date();
      cursor = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    }

    for (let i = 0; i < monthCount; i++) {
      const start = new Date(cursor.getFullYear(), cursor.getMonth() + i, 1);
      const end = new Date(cursor.getFullYear(), cursor.getMonth() + i + 1, 1);
      const entries = await db.journalEntry.findMany({
        where: { date: { gte: start, lt: end }, isPosted: true },
        include: { lines: { include: { account: true } } },
      });
      let rev = 0;
      let exp = 0;
      for (const e of entries) {
        for (const l of e.lines) {
          if (l.account.type === 'REVENUE') rev += l.credit - l.debit;
          if (l.account.type === 'EXPENSE') exp += l.debit - l.credit;
        }
      }
      months.push({
        label: start.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        revenue: money(rev),
        expenses: money(exp),
        net: money(rev - exp),
      });
    }

    return NextResponse.json({
      type: 'pl',
      range: {
        from: fromParam || null,
        to: toParam || null,
        label:
          fromParam || toParam
            ? `${fromParam ?? 'beginning'} → ${toParam ?? 'today'}`
            : 'All time',
      },
      revenue,
      expenses,
      totalRevenue,
      totalExpenses,
      netIncome,
      margin: totalRevenue > 0 ? money((netIncome / totalRevenue) * 100) : 0,
      months,
    });
  } catch (error) {
    console.error('Reports API error:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}

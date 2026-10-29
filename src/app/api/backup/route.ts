import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAccountBalances, fiscalYearLabel } from '@/lib/accounting';

// GET /api/backup — full data export as a downloadable JSON file.
// The response includes every table plus a checksum so the file can be
// verified later (trial balance must stay balanced after restore/import).
export async function GET() {
  try {
    const [accounts, journalEntries, journalLines, customers, helpers, placements, planSales, expenses, settings, balances] =
      await Promise.all([
        db.account.findMany({ orderBy: { code: 'asc' } }),
        db.journalEntry.findMany({ orderBy: { date: 'asc' } }),
        db.journalLine.findMany(),
        db.customer.findMany({ orderBy: { createdAt: 'asc' } }),
        db.helper.findMany({ orderBy: { createdAt: 'asc' } }),
        db.placement.findMany({ orderBy: { startDate: 'asc' } }),
        db.planSale.findMany({ orderBy: { saleDate: 'asc' } }),
        db.expense.findMany({ orderBy: { date: 'asc' } }),
        db.setting.findMany(),
        getAccountBalances(),
      ]);

    const totalDebit = journalLines
      .filter((l) => journalEntries.find((e) => e.id === l.entryId)?.isPosted)
      .reduce((s, l) => s + l.debit, 0);
    const totalCredit = journalLines
      .filter((l) => journalEntries.find((e) => e.id === l.entryId)?.isPosted)
      .reduce((s, l) => s + l.credit, 0);

    const payload = {
      meta: {
        app: 'MyBuddyMaid ERP',
        fiscalYear: fiscalYearLabel(),
        exportedAt: new Date().toISOString(),
        counts: {
          accounts: accounts.length,
          journalEntries: journalEntries.length,
          journalLines: journalLines.length,
          customers: customers.length,
          helpers: helpers.length,
          placements: placements.length,
          planSales: planSales.length,
          expenses: expenses.length,
        },
        integrity: {
          ledgerBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
          totalDebit: Math.round(totalDebit * 100) / 100,
          totalCredit: Math.round(totalCredit * 100) / 100,
        },
      },
      accounts,
      journalEntries,
      journalLines,
      customers,
      helpers,
      placements,
      planSales,
      expenses,
      settings,
      // convenience snapshot of current balances for quick reference
      accountBalances: balances.map((b) => ({
        code: b.code,
        name: b.name,
        type: b.type,
        balance: b.balance,
      })),
    };

    const filename = `mybuddymaid-backup-${new Date().toISOString().slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Backup GET error:', error);
    return NextResponse.json({ error: 'Failed to generate backup' }, { status: 500 });
  }
}

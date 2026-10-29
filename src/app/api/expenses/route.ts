import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_ACCOUNT,
  ACCOUNT_CODE,
  createJournalEntry,
  getAccountByCode,
  money,
} from '@/lib/accounting';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    const expenses = await db.expense.findMany({
      where: category && category !== 'ALL' ? { category } : undefined,
      orderBy: { date: 'desc' },
    });

    const result = expenses.map((e) => ({
      id: e.id,
      date: e.date,
      description: e.description,
      amount: money(e.amount),
      category: e.category,
      paymentMode: e.paymentMode,
      vendor: e.vendor,
    }));

    const total = money(result.reduce((s, e) => s + e.amount, 0));
    const categories = Array.from(new Set(result.map((e) => e.category))).sort();
    return NextResponse.json({ expenses: result, total, categories });
  } catch (error) {
    console.error('Expenses GET error:', error);
    return NextResponse.json({ error: 'Failed to load expenses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, description, amount, category, paymentMode, vendor } = body;

    if (!date || !description || !amount || Number(amount) <= 0) {
      return NextResponse.json(
        { error: 'Date, description and a positive amount are required.' },
        { status: 400 }
      );
    }
    const cat = EXPENSE_CATEGORIES.includes(category) ? category : 'Other';
    const mode = ['UPI', 'BANK', 'CASH', 'CARD'].includes(paymentMode) ? paymentMode : 'BANK';

    // Expense + auto-posted journal entry must commit or roll back together
    const created = await db.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          date: new Date(date),
          description,
          amount: money(Number(amount)),
          category: cat,
          paymentMode: mode,
          vendor: vendor || null,
        },
      });

      // auto-post journal entry: expense debit, payment account credit
      const expenseCode = EXPENSE_CATEGORY_ACCOUNT[expense.category] || '5700';
      const expenseAccount = await getAccountByCode(expenseCode, tx);
      const paymentAccount = await getAccountByCode(
        expense.paymentMode === 'CASH' ? ACCOUNT_CODE.CASH : ACCOUNT_CODE.BANK,
        tx
      );
      if (!expenseAccount || !paymentAccount) {
        throw Object.assign(new Error('Chart of accounts incomplete.'), { status: 500 });
      }

      const entry = await createJournalEntry(
        {
          date: expense.date,
          memo: `Expense — ${expense.description}`,
          reference: `EXP-${expense.id.slice(0, 8)}`,
          source: 'EXPENSE',
          lines: [
            { accountId: expenseAccount.id, debit: expense.amount, memo: expense.category },
            { accountId: paymentAccount.id, credit: expense.amount, memo: 'Paid' },
          ],
        },
        tx
      );

      return { expense, entryId: entry.id, entryNumber: entry.entryNumber };
    });

    return NextResponse.json(
      {
        expense: created.expense,
        journalEntry: { id: created.entryId, entryNumber: created.entryNumber },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const status = (error as { status?: number }).status || 500;
    const message = error instanceof Error ? error.message : 'Failed to create expense';
    console.error('Expenses POST error:', message);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing id.' }, { status: 400 });
    }

    // Deleting an expense must also reverse its auto-posted journal entry,
    // otherwise the ledger silently overstates expenses forever.
    const result = await db.$transaction(async (tx) => {
      const expense = await tx.expense.findFirst({ where: { id } });
      if (!expense) {
        throw Object.assign(new Error('Expense not found.'), { status: 404 });
      }

      // find the auto-posted entry by its EXP- reference
      const entry = await tx.journalEntry.findFirst({
        where: { reference: `EXP-${expense.id.slice(0, 8)}`, source: 'EXPENSE' },
        include: { lines: true },
      });

      if (entry && entry.isPosted) {
        const paymentCode =
          expense.paymentMode === 'CASH' ? ACCOUNT_CODE.CASH : ACCOUNT_CODE.BANK;
        const paymentAccount = await getAccountByCode(paymentCode, tx);
        const expenseCode = EXPENSE_CATEGORY_ACCOUNT[expense.category] || '5700';
        const expenseAccount = await getAccountByCode(expenseCode, tx);
        if (!paymentAccount || !expenseAccount) {
          throw Object.assign(new Error('Chart of accounts incomplete.'), { status: 500 });
        }

        // Reversing entry: Dr payment account, Cr expense account
        await createJournalEntry(
          {
            date: new Date(),
            memo: `Reversal — deleted expense "${expense.description}" (${expense.category})`,
            reference: `EXP-REV-${expense.id.slice(0, 8)}`,
            source: 'EXPENSE',
            lines: [
              { accountId: paymentAccount.id, debit: expense.amount, memo: 'Reversal of payment' },
              { accountId: expenseAccount.id, credit: expense.amount, memo: 'Reversal of expense' },
            ],
          },
          tx
        );

        // void the original entry so it stops contributing to balances
        await tx.journalEntry.update({
          where: { id: entry.id },
          data: { isPosted: false },
        });
      }

      await tx.expense.delete({ where: { id } });
      return { reversed: Boolean(entry) };
    });

    return NextResponse.json({ success: true, reversed: result.reversed });
  } catch (error: unknown) {
    const status = (error as { status?: number }).status || 500;
    const message = error instanceof Error ? error.message : 'Failed to delete expense';
    console.error('Expenses DELETE error:', message);
    return NextResponse.json({ error: message }, { status });
  }
}

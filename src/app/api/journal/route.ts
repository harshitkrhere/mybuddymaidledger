import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createJournalEntry, money } from '@/lib/accounting';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit') || 50), 200);
    const page = Math.max(Number(searchParams.get('page') || 1), 1);

    const [total, entries] = await Promise.all([
      db.journalEntry.count(),
      db.journalEntry.findMany({
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          lines: {
            include: { account: { select: { code: true, name: true, type: true } } },
            orderBy: { id: 'asc' },
          },
        },
      }),
    ]);

    return NextResponse.json({
      entries: entries.map((e) => ({
        id: e.id,
        entryNumber: e.entryNumber,
        date: e.date,
        memo: e.memo,
        reference: e.reference,
        source: e.source,
        isPosted: e.isPosted,
        lines: e.lines.map((l) => ({
          id: l.id,
          accountId: l.accountId,
          accountCode: l.account.code,
          accountName: l.account.name,
          accountType: l.account.type,
          debit: money(l.debit),
          credit: money(l.credit),
          memo: l.memo,
        })),
        totalDebit: money(e.lines.reduce((s, l) => s + l.debit, 0)),
      })),
      total,
      page,
      pageCount: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Journal GET error:', error);
    return NextResponse.json({ error: 'Failed to load journal entries' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, memo, reference, lines } = body;

    if (!date || !memo || !Array.isArray(lines) || lines.length < 2) {
      return NextResponse.json(
        { error: 'Date, memo and at least two lines are required.' },
        { status: 400 }
      );
    }

    const entry = await createJournalEntry({
      date: new Date(date),
      memo,
      reference: reference || undefined,
      source: 'MANUAL',
      lines,
    });

    return NextResponse.json(
      {
        entry: {
          id: entry.id,
          entryNumber: entry.entryNumber,
          date: entry.date,
          memo: entry.memo,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const status = (error as { status?: number }).status || 500;
    const message =
      error instanceof Error ? error.message : 'Failed to create journal entry';
    console.error('Journal POST error:', message);
    return NextResponse.json({ error: message }, { status });
  }
}

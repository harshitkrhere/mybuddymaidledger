import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ACCOUNT_TYPES, getAccountBalances } from '@/lib/accounting';

export async function GET() {
  try {
    const balances = await getAccountBalances();
    return NextResponse.json({ accounts: balances });
  } catch (error) {
    console.error('Accounts GET error:', error);
    return NextResponse.json({ error: 'Failed to load accounts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, name, type, subtype } = body;

    if (!code || !name || !type) {
      return NextResponse.json(
        { error: 'Code, name and type are required.' },
        { status: 400 }
      );
    }
    if (!ACCOUNT_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Invalid account type.' }, { status: 400 });
    }

    const existing = await db.account.findFirst({ where: { code } });
    if (existing) {
      return NextResponse.json(
        { error: `Account code "${code}" already exists.` },
        { status: 400 }
      );
    }

    const account = await db.account.create({
      data: { code: String(code), name, type, subtype: subtype || null },
    });
    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    console.error('Accounts POST error:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}

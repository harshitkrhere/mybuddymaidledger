import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PATCH: toggle active / rename
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const account = await db.account.update({
      where: { id },
      data: {
        name: body.name ?? undefined,
        isActive: body.isActive ?? undefined,
      },
    });
    return NextResponse.json({ account });
  } catch (error) {
    console.error('Account PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
  }
}

// DELETE: only allowed if account has no journal lines
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const lineCount = await db.journalLine.count({ where: { accountId: id } });
    if (lineCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete an account with transactions. Deactivate it instead.' },
        { status: 400 }
      );
    }
    await db.account.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Account DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  PLANS,
  DEFAULT_GST_RATE,
  createJournalEntry,
  getAccountByCode,
  getSettings,
  money,
  nextDocNumber,
  planRevenueCode,
  paymentAccountCode,
  ACCOUNT_CODE,
} from '@/lib/accounting';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const plan = searchParams.get('plan');

    const sales = await db.planSale.findMany({
      where: plan && plan !== 'ALL' ? { planType: plan } : undefined,
      orderBy: { saleDate: 'desc' },
      include: {
        customer: { select: { id: true, name: true, city: true, locality: true, phone: true } },
      },
    });

    const result = sales.map((s) => ({
      id: s.id,
      customerId: s.customerId,
      customer: s.customer,
      planType: s.planType,
      feeAmount: money(s.feeAmount),
      gstRate: s.gstRate,
      gstAmount: money(s.gstAmount),
      totalAmount: money(s.totalAmount),
      paymentMode: s.paymentMode,
      saleDate: s.saleDate,
      isRefunded: s.isRefunded,
      refundAmount: money(s.refundAmount),
    }));

    const totalRevenue = money(result.reduce((s, x) => s + x.feeAmount, 0));
    const totalGst = money(result.reduce((s, x) => s + x.gstAmount, 0));

    return NextResponse.json({ sales: result, totalRevenue, totalGst });
  } catch (error) {
    console.error('Plan sales GET error:', error);
    return NextResponse.json({ error: 'Failed to load plan sales' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, planType, feeAmount, gstRate, paymentMode, saleDate } = body;

    if (!customerId || !planType || !PLANS[planType as keyof typeof PLANS]) {
      return NextResponse.json({ error: 'Customer and a valid plan type are required.' }, { status: 400 });
    }
    const plan = PLANS[planType as keyof typeof PLANS];
    const settings = await getSettings();
    const defaultGst = Number(settings.defaultGstRate) || DEFAULT_GST_RATE;

    // guard: Number(undefined) is NaN and `??` does not catch it
    const parsedGst = Number(gstRate);
    const effectiveGstRate = Number.isFinite(parsedGst) && parsedGst >= 0 ? parsedGst : defaultGst;

    const fee = feeAmount != null && Number(feeAmount) > 0 ? money(Number(feeAmount)) : plan.fee;
    const gst = money(fee * (effectiveGstRate / 100));
    const total = money(fee + gst);
    const mode = ['UPI', 'BANK', 'CARD', 'CASH'].includes(paymentMode) ? paymentMode : 'UPI';
    const date = saleDate ? new Date(saleDate) : new Date();

    const customer = await db.customer.findFirst({ where: { id: customerId } });
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found.' }, { status: 400 });
    }

    // Journal entry + sale record + customer coverage update commit atomically
    const created = await db.$transaction(async (tx) => {
      const revenueAccount = await getAccountByCode(planRevenueCode(planType), tx);
      const payAccount = await getAccountByCode(paymentAccountCode(mode), tx);
      const gstAccount = await getAccountByCode(ACCOUNT_CODE.GST_PAYABLE, tx);
      if (!revenueAccount || !payAccount || !gstAccount) {
        throw Object.assign(new Error('Chart of accounts incomplete.'), { status: 500 });
      }

      const saleRef = await nextDocNumber('SALE', tx);

      const entry = await createJournalEntry(
        {
          date,
          memo: `Plan sale — ${planType} (${customer.name}, ${customer.city})`,
          reference: saleRef,
          source: 'PLAN_SALE',
          lines: [
            { accountId: payAccount.id, debit: total, memo: `${mode} received` },
            { accountId: revenueAccount.id, credit: fee, memo: `${planType} plan fee` },
            { accountId: gstAccount.id, credit: gst, memo: 'GST output @' + effectiveGstRate + '%' },
          ],
        },
        tx
      );

      const sale = await tx.planSale.create({
        data: {
          customerId,
          planType,
          feeAmount: fee,
          gstRate: effectiveGstRate,
          gstAmount: gst,
          totalAmount: total,
          paymentMode: mode,
          saleDate: date,
        },
      });

      const expiry = new Date(date);
      expiry.setMonth(expiry.getMonth() + plan.coverageMonths);
      await tx.customer.update({
        where: { id: customerId },
        data: {
          planType,
          planFee: fee,
          planPurchaseDate: date,
          planExpiryDate: expiry,
          maxPlacements: plan.maxPlacements,
          placementsUsed: 0,
          status: 'ACTIVE',
        },
      });

      return { sale, entryId: entry.id, entryNumber: entry.entryNumber, saleRef };
    });

    return NextResponse.json(
      {
        sale: created.sale,
        saleRef: created.saleRef,
        journalEntry: { id: created.entryId, entryNumber: created.entryNumber },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const status = (error as { status?: number }).status || 500;
    const message = error instanceof Error ? error.message : 'Failed to record plan sale';
    console.error('Plan sale POST error:', message);
    return NextResponse.json({ error: message }, { status });
  }
}

// PATCH — refund a sale (non-refundable portion from settings stays with the company)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, refundAmount } = body;
    if (!id) return NextResponse.json({ error: 'Missing sale id.' }, { status: 400 });

    const settings = await getSettings();
    const nonRefundable = Number(settings.nonRefundablePortion) || 0;

    const sale = await db.planSale.findFirst({
      where: { id },
      include: { customer: true },
    });
    if (!sale) return NextResponse.json({ error: 'Sale not found.' }, { status: 404 });
    if (sale.isRefunded) return NextResponse.json({ error: 'Sale already refunded.' }, { status: 400 });

    const refundableMax = money(Math.max(0, sale.feeAmount - nonRefundable));
    const requested =
      refundAmount != null && Number(refundAmount) > 0 ? money(Number(refundAmount)) : refundableMax;
    if (requested > refundableMax + 0.005) {
      return NextResponse.json(
        {
          error: `Refund cannot exceed ₹${refundableMax.toLocaleString('en-IN')} (fee minus ₹${nonRefundable.toLocaleString('en-IN')} non-refundable portion).`,
        },
        { status: 400 }
      );
    }

    const result = await db.$transaction(async (tx) => {
      const refundsAccount = await getAccountByCode(ACCOUNT_CODE.REFUNDS_EXPENSE, tx);
      const bankAccount = await getAccountByCode(ACCOUNT_CODE.BANK, tx);
      if (!refundsAccount || !bankAccount) {
        throw Object.assign(new Error('Chart of accounts incomplete.'), { status: 500 });
      }

      await createJournalEntry(
        {
          date: new Date(),
          memo: `Refund — ${sale.planType} plan (${sale.customer.name})`,
          reference: `REF-${sale.id.slice(0, 8)}`,
          source: 'REFUND',
          lines: [
            { accountId: refundsAccount.id, debit: requested, memo: 'Refund of refundable portion' },
            { accountId: bankAccount.id, credit: requested, memo: 'Bank transfer to customer' },
          ],
        },
        tx
      );

      const updated = await tx.planSale.update({
        where: { id },
        data: { isRefunded: true, refundAmount: requested },
      });
      await tx.customer.update({
        where: { id: sale.customerId },
        data: { status: 'REFUNDED' },
      });
      return updated;
    });

    return NextResponse.json({ sale: result, refunded: requested });
  } catch (error: unknown) {
    const status = (error as { status?: number }).status || 500;
    const message = error instanceof Error ? error.message : 'Failed to refund sale';
    console.error('Plan sale PATCH error:', message);
    return NextResponse.json({ error: message }, { status });
  }
}

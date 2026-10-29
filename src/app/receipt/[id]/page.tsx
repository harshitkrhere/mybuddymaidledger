import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { getSettings, PLANS, PlanType, money } from '@/lib/accounting';
import { ReceiptActions } from '@/components/erp/receipt-actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const sale = await db.planSale.findFirst({
    where: { id },
    include: { customer: { select: { name: true } } },
  });
  if (!sale) return { title: 'Receipt not found' };
  return {
    title: `Receipt — ${sale.customer.name} (${sale.planType})`,
    description: `GST receipt for ${sale.planType} plan sale of ₹${money(sale.totalAmount).toLocaleString('en-IN')}`,
  };
}

function fmtINR(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function numberToWords(n: number): string {
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
    'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const below1000 = (x: number): string => {
    if (x < 20) return ones[x];
    if (x < 100) return `${tens[Math.floor(x / 10)]}${x % 10 ? ' ' + ones[x % 10] : ''}`;
    return `${ones[Math.floor(x / 100)]} Hundred${x % 100 ? ' ' + below1000(x % 100) : ''}`;
  };

  const integer = Math.floor(n);
  const paise = Math.round((n - integer) * 100);
  if (integer === 0 && paise === 0) return 'Zero Rupees Only';

  const parts: string[] = [];
  const units: { value: number; label: string }[] = [
    { value: 10000000, label: 'Crore' },
    { value: 100000, label: 'Lakh' },
    { value: 1000, label: 'Thousand' },
  ];
  let rest = integer;
  for (const u of units) {
    const q = Math.floor(rest / u.value);
    if (q > 0) {
      parts.push(`${below1000(q)} ${u.label}`);
      rest -= q * u.value;
    }
  }
  if (rest > 0) parts.push(below1000(rest));
  let words = `${parts.join(' ')} Rupees`;
  if (paise > 0) words += ` and ${below1000(paise)} Paise`;
  return `${words} Only`;
}

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sale = await db.planSale.findFirst({
    where: { id },
    include: { customer: true },
  });
  if (!sale) notFound();

  const settings = await getSettings();
  const plan = PLANS[sale.planType as PlanType];
  const planLabel = plan?.label ?? sale.planType;
  const paymentModeLabels: Record<string, string> = {
    UPI: 'UPI',
    BANK: 'Bank Transfer',
    CARD: 'Card',
    CASH: 'Cash',
  };

  const receiptNo = `RCPT-${sale.saleDate.getFullYear()}-${String(
    (await db.planSale.count({ where: { saleDate: { lte: sale.saleDate } } })).toString()
  ).padStart(4, '0')}`;

  const coverageEnd = new Date(sale.saleDate);
  coverageEnd.setMonth(coverageEnd.getMonth() + (plan?.coverageMonths ?? 10));

  const company = settings as Record<string, string | number>;
  const gstin = String(company.gstin || '');

  return (
    <div className="min-h-screen bg-[#f5f5f7] print:bg-white">
      <ReceiptActions saleId={sale.id} />

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 print:max-w-none print:p-0">
        <div className="card-shadow rounded-[20px] border border-black/[0.06] bg-white print:rounded-none print:border-0 print:shadow-none">
          {/* Header */}
          <div className="flex flex-col justify-between gap-4 border-b p-6 sm:flex-row sm:items-start">
            <div>
              <p className="text-lg font-bold tracking-tight">{String(company.companyName)}</p>
              <p className="text-xs text-muted-foreground">{String(company.companyTagline)}</p>
              <p className="mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">
                {String(company.address)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {String(company.phone)} · {String(company.email)}
              </p>
              {gstin && (
                <p className="mt-1 text-xs font-medium">GSTIN: {gstin}</p>
              )}
            </div>
            <div className="sm:text-right">
              <p className="text-sm font-semibold uppercase tracking-wider text-[#0071E3]">
                Tax Invoice / Receipt
              </p>
              <dl className="mt-2 space-y-0.5 text-xs">
                <div className="flex gap-2 sm:justify-end">
                  <dt className="text-muted-foreground">Receipt No:</dt>
                  <dd className="font-medium">{receiptNo}</dd>
                </div>
                <div className="flex gap-2 sm:justify-end">
                  <dt className="text-muted-foreground">Date:</dt>
                  <dd className="font-medium">{fmtDate(sale.saleDate)}</dd>
                </div>
                <div className="flex gap-2 sm:justify-end">
                  <dt className="text-muted-foreground">Payment Mode:</dt>
                  <dd className="font-medium">{paymentModeLabels[sale.paymentMode] ?? sale.paymentMode}</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Billed to */}
          <div className="grid gap-4 border-b p-6 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Billed To
              </p>
              <p className="mt-1 text-sm font-semibold">{sale.customer.name}</p>
              <p className="text-xs text-muted-foreground">
                {[sale.customer.locality, sale.customer.city].filter(Boolean).join(', ')}
              </p>
              {sale.customer.address && (
                <p className="text-xs text-muted-foreground">{sale.customer.address}</p>
              )}
              {sale.customer.phone && (
                <p className="mt-0.5 text-xs text-muted-foreground">{sale.customer.phone}</p>
              )}
            </div>
            <div className="sm:text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Plan Purchased
              </p>
              <p className="mt-1 text-sm font-semibold text-[#C77C00]">
                {planLabel} — {String(company.companyName)} Plan
              </p>
              <p className="text-xs text-muted-foreground">
                Coverage until {fmtDate(coverageEnd)} ({plan?.coverageMonths ?? 10} months)
              </p>
              <p className="text-xs text-muted-foreground">
                Includes up to {plan?.maxPlacements ?? 3} placements/replacements ·{' '}
                {plan?.profiles ?? 3} verified profiles to interview
              </p>
            </div>
          </div>

          {/* Line items */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-2.5 font-semibold">Description</th>
                <th className="px-4 py-2.5 text-right font-semibold">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="px-6 py-3">
                  <p className="font-medium">
                    {planLabel} Plan — one-time platform fee
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Placement &amp; replacement cover · helper salary paid directly by household
                  </p>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtINR(money(sale.feeAmount))}</td>
              </tr>
              <tr className="border-b">
                <td className="px-6 py-3 text-muted-foreground">GST @ {sale.gstRate}%</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtINR(money(sale.gstAmount))}</td>
              </tr>
              <tr className="bg-[#0071E3]/[0.04]">
                <td className="px-6 py-3.5 text-[15px] font-bold">Total Paid</td>
                <td className="num px-4 py-3.5 text-right text-[15px] font-bold">
                  ₹{fmtINR(money(sale.totalAmount))}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Amount in words + terms */}
          <div className="space-y-4 border-t p-6">
            <p className="text-xs">
              <span className="font-semibold">Amount in words:</span>{' '}
              {numberToWords(money(sale.totalAmount))}
            </p>

            <div className="rounded-[14px] bg-black/[0.03] p-4 text-xs leading-relaxed text-muted-foreground">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-foreground">Terms</p>
              <ul className="list-disc space-y-1 pl-4">
                <li>
                  ₹{fmtINR(Number(company.nonRefundablePortion))} of every plan fee is
                  non-refundable and covers onboarding &amp; verification.
                </li>
                <li>
                  If a helper leaves or does not work out, a replacement profile is shared within
                  48 hours, subject to plan limits.
                </li>
                <li>
                  Helper salaries are agreed between the household and the helper and paid
                  directly to the helper.
                </li>
                <li>Support hours: {String(company.supportHours)}.</li>
              </ul>
            </div>

            {sale.isRefunded && (
              <p className="rounded-[12px] bg-[#FF3B30]/[0.07] px-3.5 py-2.5 text-xs font-medium text-[#D70015]">
                Refunded: ₹{fmtINR(money(sale.refundAmount))} refunded to customer on record.
              </p>
            )}

            <div className="flex items-end justify-between pt-8">
              <p className="text-[11px] text-muted-foreground">
                This is a computer-generated receipt.
              </p>
              <div className="text-center">
                <p className="mb-8 text-xs font-medium">For {String(company.companyName)}</p>
                <p className="border-t border-muted-foreground/40 pt-1 text-[11px] text-muted-foreground">
                  Authorised Signatory
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

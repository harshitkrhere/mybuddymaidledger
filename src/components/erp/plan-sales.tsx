'use client';

import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Printer, RotateCcw, Receipt, TrendingUp, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { fmtMoney, fmtDate, PlanBadge, LoadingBlock, ErrorNote, KpiCard, FadeIn, Card, TH, TH_R } from './shared';
import { SegmentedControl } from './shell';
import { cn } from '@/lib/utils';

interface SaleRow {
  id: string;
  customerId: string;
  customer: { id: string; name: string; city: string; locality: string | null; phone: string | null };
  planType: string;
  feeAmount: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  paymentMode: string;
  saleDate: string;
  isRefunded: boolean;
  refundAmount: number;
}

interface CustomerOption {
  id: string;
  name: string;
  city: string;
  planType: string | null;
  status: string;
}

const PLAN_FEES: Record<string, number> = { SILVER: 4999, GOLD: 5999, DIAMOND: 6999 };
const PLAN_COVERAGE: Record<string, string> = {
  SILVER: '10 months · 3 placements',
  GOLD: '12 months · 5 placements',
  DIAMOND: '18 months · 10 placements',
};
const PAYMENT_MODES = [
  { value: 'UPI', label: 'UPI' },
  { value: 'BANK', label: 'Bank Transfer' },
  { value: 'CARD', label: 'Card' },
  { value: 'CASH', label: 'Cash' },
];

export function PlanSales() {
  const { toast } = useToast();
  const [sales, setSales] = useState<SaleRow[] | null>(null);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [refundTarget, setRefundTarget] = useState<SaleRow | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [nonRefundablePortion, setNonRefundablePortion] = useState(2000);

  const [form, setForm] = useState({
    customerId: '',
    planType: 'GOLD',
    feeAmount: '5999',
    gstRate: '18',
    paymentMode: 'UPI',
    saleDate: new Date().toISOString().slice(0, 10),
  });

  const load = async () => {
    try {
      setError('');
      const [saleRes, custRes, setRes] = await Promise.all([
        fetch('/api/plan-sales'),
        fetch('/api/customers'),
        fetch('/api/settings'),
      ]);
      if (!saleRes.ok || !custRes.ok) throw new Error();
      const saleJson = await saleRes.json();
      const custJson = await custRes.json();
      setSales(saleJson.sales);
      setCustomers(custJson.customers);
      if (setRes.ok) {
        const setJson = await setRes.json();
        setNonRefundablePortion(Number(setJson.settings?.nonRefundablePortion) || 2000);
      }
    } catch {
      setError('Could not load plan sales. Please refresh.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  // global "New Sale" action from the toolbar
  useEffect(() => {
    const open = () => setCreateOpen(true);
    window.addEventListener('mbm:new-plan-sale', open);
    return () => window.removeEventListener('mbm:new-plan-sale', open);
  }, []);

  const filtered = useMemo(() => {
    if (!sales) return [];
    return tab === 'ALL'
      ? sales
      : tab === 'REFUNDED'
        ? sales.filter((s) => s.isRefunded)
        : sales.filter((s) => s.planType === tab && !s.isRefunded);
  }, [sales, tab]);

  const totals = useMemo(() => {
    if (!sales) return null;
    return {
      revenue: sales.filter((s) => !s.isRefunded).reduce((s, x) => s + x.feeAmount, 0),
      gst: sales.filter((s) => !s.isRefunded).reduce((s, x) => s + x.gstAmount, 0),
      count: sales.filter((s) => !s.isRefunded).length,
    };
  }, [sales]);

  const computed = useMemo(() => {
    const fee = parseFloat(form.feeAmount) || 0;
    const gst = (fee * (parseFloat(form.gstRate) || 0)) / 100;
    return { fee, gst, total: fee + gst };
  }, [form.feeAmount, form.gstRate]);

  const submit = async () => {
    if (!form.customerId) {
      toast({ title: 'Please select a customer.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/plan-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: form.customerId,
          planType: form.planType,
          feeAmount: parseFloat(form.feeAmount) || undefined,
          gstRate: parseFloat(form.gstRate),
          paymentMode: form.paymentMode,
          saleDate: form.saleDate,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to record sale');
      toast({
        title: `${form.planType[0]}${form.planType.slice(1).toLowerCase()} plan sold — ${fmtMoney(computed.total)} received`,
        description: `Journal entry ${json.journalEntry.entryNumber} posted (revenue + GST).`,
      });
      setCreateOpen(false);
      await load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Failed to record sale', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const refund = async () => {
    if (!refundTarget) return;
    setBusyId(refundTarget.id);
    try {
      const res = await fetch('/api/plan-sales', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: refundTarget.id,
          refundAmount: refundAmount ? parseFloat(refundAmount) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to refund');
      toast({
        title: `Refund processed — ${fmtMoney(json.refunded)}`,
        description: 'Refund journal entry posted.',
      });
      setRefundTarget(null);
      setRefundAmount('');
      await load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Failed to refund', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  if (error) return <ErrorNote message={error} />;
  if (!sales) return <LoadingBlock label="Loading plan sales…" />;

  return (
    <div className="space-y-5">
      {totals && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FadeIn delay={0.03}>
            <KpiCard label="Plans Sold" value={String(totals.count)} sub="excluding refunded" icon={<Receipt />} />
          </FadeIn>
          <FadeIn delay={0.09}>
            <KpiCard label="Fee Revenue" value={fmtMoney(totals.revenue, { compact: true })} sub="excluding GST · all time" icon={<TrendingUp />} />
          </FadeIn>
          <FadeIn delay={0.15}>
            <KpiCard label="GST Collected" value={fmtMoney(totals.gst, { compact: true })} sub="output tax on platform fees" icon={<Wallet />} />
          </FadeIn>
        </div>
      )}

      <FadeIn delay={0.1}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedControl
            options={[
              { value: 'ALL', label: 'All' },
              { value: 'SILVER', label: 'Silver' },
              { value: 'GOLD', label: 'Gold' },
              { value: 'DIAMOND', label: 'Diamond' },
              { value: 'REFUNDED', label: 'Refunded' },
            ]}
            value={tab}
            onChange={setTab}
          />
          <Button onClick={() => setCreateOpen(true)} className="shrink-0">
            Record Plan Sale
          </Button>
        </div>
      </FadeIn>

      <FadeIn delay={0.16}>
        <Card className="overflow-hidden py-0">
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[0.06]">
                  <th scope="col" className={TH}>Date</th>
                  <th scope="col" className={TH}>Customer</th>
                  <th scope="col" className={TH}>Plan</th>
                  <th scope="col" className={cn(TH_R, 'hidden sm:table-cell')}>Fee</th>
                  <th scope="col" className={cn(TH_R, 'hidden md:table-cell')}>GST</th>
                  <th scope="col" className={TH_R}>Total</th>
                  <th scope="col" className={cn(TH, 'hidden lg:table-cell')}>Paid via</th>
                  <th scope="col" className={TH_R}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className={cn(
                      'border-b border-black/[0.045] transition-colors last:border-0 hover:bg-black/[0.015]',
                      s.isRefunded && 'opacity-60'
                    )}
                  >
                    <td className="num whitespace-nowrap px-4 py-3.5 text-[13px] text-muted-foreground">{fmtDate(s.saleDate)}</td>
                    <td className="px-4 py-3.5">
                      <p className="text-[14px] font-medium leading-tight">{s.customer.name}</p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        {s.customer.locality ? `${s.customer.locality}, ` : ''}
                        {s.customer.city}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <PlanBadge plan={s.planType} />
                    </td>
                    <td className="num hidden px-4 py-3.5 text-right text-[13.5px] sm:table-cell">{fmtMoney(s.feeAmount)}</td>
                    <td className="num hidden px-4 py-3.5 text-right text-[13.5px] text-muted-foreground md:table-cell">
                      {fmtMoney(s.gstAmount)}
                    </td>
                    <td className="num px-4 py-3.5 text-right text-[14px] font-semibold">
                      {fmtMoney(s.totalAmount)}
                      {s.isRefunded && (
                        <p className="mt-0.5 text-[11.5px] font-normal text-[#FF3B30]">refunded {fmtMoney(s.refundAmount)}</p>
                      )}
                    </td>
                    <td className="hidden px-4 py-3.5 text-[13px] text-muted-foreground lg:table-cell">{s.paymentMode}</td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-full"
                          onClick={() => window.open(`/receipt/${s.id}`, '_blank')}
                          title="View / print GST receipt"
                        >
                          <Printer className="h-3.5 w-3.5" /> Receipt
                        </Button>
                        {!s.isRefunded && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-full text-[#FF3B30] hover:bg-[#FF3B30]/[0.07] hover:text-[#E5342B]"
                            disabled={busyId === s.id}
                            onClick={() => {
                              setRefundTarget(s);
                              setRefundAmount(String(Math.round(Math.max(0, s.feeAmount - nonRefundablePortion) * 100) / 100));
                            }}
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Refund
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-14 text-center">
                      <Receipt className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" strokeWidth={1.6} />
                      <p className="text-[14px] font-semibold">No plan sales found</p>
                      <p className="mt-0.5 text-[12.5px] text-muted-foreground">Try a different filter or record a new sale.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </FadeIn>

      {/* create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Plan Sale</DialogTitle>
            <DialogDescription>Revenue and GST journal entries are posted automatically.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Customer</Label>
              <Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select customer…" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} — {c.city}
                      {c.planType ? ` (${c.planType.toLowerCase()})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Plan</Label>
              <div className="grid grid-cols-3 gap-2.5">
                {(['SILVER', 'GOLD', 'DIAMOND'] as const).map((p) => {
                  const selected = form.planType === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setForm({ ...form, planType: p, feeAmount: String(PLAN_FEES[p]) })}
                      className={cn(
                        'press relative rounded-[16px] border p-3.5 text-left transition-colors',
                        selected ? 'border-[#0071E3] bg-[#0071E3]/[0.05]' : 'border-black/[0.08] bg-black/[0.02] hover:bg-black/[0.04]'
                      )}
                    >
                      {selected && (
                        <span className="absolute right-2.5 top-2.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#0071E3] text-white">
                          <BadgeCheck className="h-3 w-3" strokeWidth={2.5} />
                        </span>
                      )}
                      <p className="text-[14px] font-semibold capitalize">{p}</p>
                      <p className="num mt-0.5 text-[13px] text-foreground/70">₹{PLAN_FEES[p].toLocaleString('en-IN')}</p>
                      <p className="mt-1.5 text-[11px] leading-tight text-muted-foreground">{PLAN_COVERAGE[p]}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fee">Fee amount (₹)</Label>
                <Input
                  id="fee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.feeAmount}
                  onChange={(e) => setForm({ ...form, feeAmount: e.target.value })}
                  className="num text-right"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gst">GST rate (%)</Label>
                <Input
                  id="gst"
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.gstRate}
                  onChange={(e) => setForm({ ...form, gstRate: e.target.value })}
                  className="num text-right"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Paid via</Label>
                <Select value={form.paymentMode} onValueChange={(v) => setForm({ ...form, paymentMode: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sale-date">Sale date</Label>
                <Input
                  id="sale-date"
                  type="date"
                  value={form.saleDate}
                  onChange={(e) => setForm({ ...form, saleDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2.5 rounded-[14px] bg-black/[0.035] p-4 text-[14px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan fee</span>
                <span className="num">{fmtMoney(computed.fee)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">GST ({form.gstRate}%)</span>
                <span className="num">{fmtMoney(computed.gst)}</span>
              </div>
              <div className="flex justify-between border-t border-black/[0.07] pt-2.5 text-[15px] font-semibold">
                <span>Total collected</span>
                <span className="num">{fmtMoney(computed.total)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? 'Recording…' : 'Record Sale'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* refund dialog */}
      <Dialog open={!!refundTarget} onOpenChange={(o) => !o && setRefundTarget(null)}>
        <DialogContent className="sm:max-w-md">
          {refundTarget && (
            <>
              <DialogHeader>
                <DialogTitle>Refund Plan Sale</DialogTitle>
                <DialogDescription>
                  {refundTarget.customer.name} — {refundTarget.planType.toLowerCase()} plan, {fmtDate(refundTarget.saleDate)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-[14px] bg-[#FF9500]/[0.09] p-4 text-[13.5px] leading-relaxed text-[#9A6200]">
                  Per policy, ₹{nonRefundablePortion.toLocaleString('en-IN')} of every plan fee is non-refundable (covers
                  onboarding &amp; verification). Maximum refundable:{' '}
                  <strong className="font-semibold">
                    ₹{Math.round(Math.max(0, refundTarget.feeAmount - nonRefundablePortion) * 100) / 100}
                  </strong>
                  .
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="refund-amt">Refund amount (₹)</Label>
                  <Input
                    id="refund-amt"
                    type="number"
                    min="0"
                    step="0.01"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="num text-right"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setRefundTarget(null)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={refund} disabled={busyId === refundTarget.id}>
                  {busyId === refundTarget.id ? 'Processing…' : 'Process Refund'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

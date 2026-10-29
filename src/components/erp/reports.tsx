'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Scale, CalendarRange, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { fmtMoney, LoadingBlock, ErrorNote, FadeIn, Card, SecHead, EASE_APPLE, TH, TH_R } from './shared';
import { SegmentedControl } from './shell';
import { cn } from '@/lib/utils';

interface AccountBalance {
  id: string;
  code: string;
  name: string;
  type: string;
  balance: number;
}

interface PLData {
  type: 'pl';
  range: { from: string | null; to: string | null; label: string };
  revenue: AccountBalance[];
  expenses: AccountBalance[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  margin: number;
  months: { label: string; revenue: number; expenses: number; net: number }[];
}

interface BalanceData {
  type: 'balance';
  assets: AccountBalance[];
  liabilities: AccountBalance[];
  equity: AccountBalance[];
  netIncome: number;
  totalRevenue: number;
  totalExpenses: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  balanced: boolean;
}

interface TrialData {
  type: 'trial';
  rows: { code: string; name: string; type: string; debit: number; credit: number }[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}

type ReportData = PLData | BalanceData | TrialData;

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fyRange(): { from: string; to: string } {
  const now = new Date();
  const apr1 = new Date(now.getFullYear(), 3, 1);
  const start = now >= apr1 ? apr1 : new Date(now.getFullYear() - 1, 3, 1);
  const end = new Date(start.getFullYear() + 1, 3, 0); // Mar 31
  return { from: isoDate(start), to: isoDate(end) };
}

const RANGE_PRESETS: { key: string; label: string; compute: () => { from: string; to: string } | null }[] = [
  { key: 'all', label: 'All Time', compute: () => null },
  { key: 'fy', label: 'This FY', compute: () => fyRange() },
  {
    key: 'month',
    label: 'This Month',
    compute: () => {
      const now = new Date();
      return {
        from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      };
    },
  },
];

export function Reports() {
  const { toast } = useToast();
  const [tab, setTab] = useState('pl');
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState('');
  const [rangeKey, setRangeKey] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const load = async (type: string) => {
    try {
      setError('');
      let qs = `type=${type}`;
      if (type === 'pl') {
        if (rangeKey === 'custom') {
          if (customFrom) qs += `&from=${customFrom}`;
          if (customTo) qs += `&to=${customTo}`;
        } else {
          const preset = RANGE_PRESETS.find((p) => p.key === rangeKey);
          const r = preset?.compute() ?? null;
          if (r) qs += `&from=${r.from}&to=${r.to}`;
        }
      }
      const res = await fetch(`/api/reports?${qs}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setError('Could not generate report. Please refresh.');
    }
  };

  useEffect(() => {
    load(tab);
  }, [tab, rangeKey, customFrom, customTo]);

  const exportCsv = () => {
    if (!data) return;
    let csv = '';
    if (data.type === 'pl') {
      csv = `Profit and Loss,${data.range?.label ?? 'All time'}\n\n`;
      csv += 'Section,Code,Account,Amount\n';
      csv += data.revenue.map((r) => `Revenue,${r.code},"${r.name}",${r.balance}`).join('\n') + '\n';
      csv += `,,Total Revenue,${data.totalRevenue}\n`;
      csv += data.expenses.map((r) => `Expenses,${r.code},"${r.name}",${r.balance}`).join('\n') + '\n';
      csv += `,,Total Expenses,${data.totalExpenses}\n`;
      csv += `,,Net Income,${data.netIncome}\n`;
    } else if (data.type === 'balance') {
      csv = 'Section,Code,Account,Amount\n';
      csv += data.assets.map((r) => `Assets,${r.code},"${r.name}",${r.balance}`).join('\n') + '\n';
      csv += `,,Total Assets,${data.totalAssets}\n`;
      csv += data.liabilities.map((r) => `Liabilities,${r.code},"${r.name}",${r.balance}`).join('\n') + '\n';
      csv += `,,Total Liabilities,${data.totalLiabilities}\n`;
      csv += data.equity.map((r) => `Equity,${r.code},"${r.name}",${r.balance}`).join('\n') + '\n';
      csv += `,,Net Income,${data.netIncome}\n`;
      csv += `,,Total Equity,${data.totalEquity}\n`;
    } else {
      csv = 'Code,Account,Type,Debit,Credit\n';
      csv += data.rows
        .map((r) => `${r.code},"${r.name}",${r.type},${r.debit},${r.credit}`)
        .join('\n') + '\n';
      csv += `,,Totals,${data.totalDebit},${data.totalCredit}\n`;
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.type === 'pl' ? 'profit-and-loss' : data.type === 'balance' ? 'balance-sheet' : 'trial-balance'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exported' });
  };

  if (error) return <ErrorNote message={error} />;
  if (!data) return <LoadingBlock label="Generating report…" />;

  return (
    <div className="space-y-5">
      <FadeIn delay={0.05}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedControl
            options={[
              { value: 'pl', label: 'Profit & Loss' },
              { value: 'balance', label: 'Balance Sheet' },
              { value: 'trial', label: 'Trial Balance' },
            ]}
            value={tab}
            onChange={setTab}
          />
          <Button variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </FadeIn>

      {/* Date range toolbar — P&L only (balance sheet & trial balance are point-in-time) */}
      {tab === 'pl' && (
        <FadeIn delay={0.1}>
          <div className="flex flex-col gap-3 rounded-[16px] border border-black/[0.06] bg-card p-3.5 card-shadow sm:flex-row sm:items-center sm:flex-wrap">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              <CalendarRange className="h-3.5 w-3.5" strokeWidth={2} />
              Period
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[...RANGE_PRESETS, { key: 'custom', label: 'Custom' }].map((p) => {
                const active = rangeKey === p.key;
                return (
                  <button
                    key={p.key}
                    onClick={() => setRangeKey(p.key)}
                    className={cn(
                      'press rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors',
                      active ? 'bg-[#0071E3] text-white shadow-[0_2px_8px_rgba(0,113,227,0.25)]' : 'bg-black/[0.05] text-muted-foreground hover:bg-black/[0.08] hover:text-foreground'
                    )}
                    aria-pressed={active}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            {rangeKey === 'custom' && (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-9 w-36 rounded-[10px] text-[13px]"
                  aria-label="From date"
                />
                <span className="text-[12.5px] text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-9 w-36 rounded-[10px] text-[13px]"
                  aria-label="To date"
                />
              </div>
            )}
            {data?.type === 'pl' && data.range && (
              <p className="text-[12.5px] text-muted-foreground sm:ml-auto">{data.range.label}</p>
            )}
          </div>
        </FadeIn>
      )}

      {/* ===== P&L ===== */}
      {data.type === 'pl' && (
        <div className="grid gap-5 lg:grid-cols-3">
          <FadeIn delay={0.12} className="lg:col-span-2">
            <Card className="p-5 sm:p-6">
              <SecHead title="Profit & Loss" meta={data.range?.label ?? 'All time'} className="px-0" />
              <div className="mt-4 space-y-7">
                <section>
                  <h3 className="micro-label mb-2">Revenue</h3>
                  <ul className="space-y-1">
                    {data.revenue.map((r) => (
                      <li key={r.id} className="flex items-baseline justify-between border-b border-black/[0.05] py-2 text-[14px]">
                        <span className="text-muted-foreground">
                          <span className="num mr-2 text-[12px]">{r.code}</span>
                          {r.name}
                        </span>
                        <span className="num">{fmtMoney(r.balance)}</span>
                      </li>
                    ))}
                    {data.revenue.length === 0 && (
                      <li className="py-2 text-[13.5px] text-muted-foreground">No revenue recorded.</li>
                    )}
                  </ul>
                  <div className="num mt-3 flex justify-between border-t-2 border-black/[0.08] pt-2.5 text-[15px] font-bold">
                    <span>Total Revenue</span>
                    <span>{fmtMoney(data.totalRevenue)}</span>
                  </div>
                </section>

                <section>
                  <h3 className="micro-label mb-2 text-[#C77C00]">Expenses</h3>
                  <ul className="space-y-1">
                    {data.expenses.map((r) => (
                      <li key={r.id} className="flex items-baseline justify-between border-b border-black/[0.05] py-2 text-[14px]">
                        <span className="text-muted-foreground">
                          <span className="num mr-2 text-[12px]">{r.code}</span>
                          {r.name}
                        </span>
                        <span className="num">{fmtMoney(r.balance)}</span>
                      </li>
                    ))}
                    {data.expenses.length === 0 && (
                      <li className="py-2 text-[13.5px] text-muted-foreground">No expenses recorded.</li>
                    )}
                  </ul>
                  <div className="num mt-3 flex justify-between border-t-2 border-black/[0.08] pt-2.5 text-[15px] font-bold">
                    <span>Total Expenses</span>
                    <span className="text-[#C77C00]">{fmtMoney(data.totalExpenses)}</span>
                  </div>
                </section>

                <div
                  className={cn(
                    'flex items-center justify-between rounded-[16px] p-5',
                    data.netIncome >= 0 ? 'bg-[#34C759]/[0.09]' : 'bg-[#FF3B30]/[0.07]'
                  )}
                >
                  <div>
                    <p className="text-[15px] font-bold tracking-[-0.01em]">Net Income</p>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">Profit margin {data.margin.toFixed(1)}%</p>
                  </div>
                  <p
                    className={cn(
                      'num text-[28px] font-bold tracking-[-0.02em]',
                      data.netIncome >= 0 ? 'text-[#248A3D]' : 'text-[#FF3B30]'
                    )}
                  >
                    {fmtMoney(data.netIncome, { sign: true })}
                  </p>
                </div>
              </div>
            </Card>
          </FadeIn>

          <FadeIn delay={0.18}>
            <Card className="h-full p-5">
              <SecHead
                title="Monthly Trend"
                meta={data.range && (data.range.from || data.range.to) ? 'within period · max 12' : 'last 6 months'}
                className="px-0"
              />
              <ul className="mt-4 space-y-1">
                {data.months.map((m) => {
                  const max = Math.max(...data.months.map((x) => Math.max(x.revenue, x.expenses)), 1);
                  return (
                    <li key={m.label} className="space-y-1.5 rounded-[12px] p-2.5 transition-colors hover:bg-black/[0.02]">
                      <div className="flex items-center justify-between text-[13.5px]">
                        <span className="font-semibold">{m.label}</span>
                        <span className={cn('num font-semibold', m.net >= 0 ? 'text-[#248A3D]' : 'text-[#FF3B30]')}>
                          {fmtMoney(m.net, { sign: true })}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-black/[0.05]">
                            <motion.div
                              className="h-full rounded-full bg-[#0071E3]"
                              initial={{ width: 0 }}
                              animate={{ width: `${(m.revenue / max) * 100}%` }}
                              transition={{ duration: 0.7, ease: EASE_APPLE }}
                            />
                          </div>
                          <span className="num w-16 text-right text-[11.5px] text-muted-foreground">
                            {fmtMoney(m.revenue, { compact: true })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-black/[0.05]">
                            <motion.div
                              className="h-full rounded-full bg-[#FF9500]"
                              initial={{ width: 0 }}
                              animate={{ width: `${(m.expenses / max) * 100}%` }}
                              transition={{ duration: 0.7, delay: 0.08, ease: EASE_APPLE }}
                            />
                          </div>
                          <span className="num w-16 text-right text-[11.5px] text-muted-foreground">
                            {fmtMoney(m.expenses, { compact: true })}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </FadeIn>
        </div>
      )}

      {/* ===== Balance Sheet ===== */}
      {data.type === 'balance' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <FadeIn delay={0.12}>
            <Card className="h-full p-5 sm:p-6">
              <SecHead title="Assets" meta="what the business owns" className="px-0" />
              <ul className="mt-4 space-y-1">
                {data.assets.map((a) => (
                  <li key={a.id} className="flex items-baseline justify-between border-b border-black/[0.05] py-2.5 text-[14px]">
                    <span className="text-muted-foreground">
                      <span className="num mr-2 text-[12px]">{a.code}</span>
                      {a.name}
                    </span>
                    <span className="num">{fmtMoney(a.balance)}</span>
                  </li>
                ))}
              </ul>
              <div className="num mt-3 flex justify-between border-t-2 border-black/[0.08] pt-3 text-[16px] font-bold">
                <span>Total Assets</span>
                <span className="text-[#0071E3]">{fmtMoney(data.totalAssets)}</span>
              </div>
            </Card>
          </FadeIn>

          <FadeIn delay={0.18}>
            <Card className="h-full p-5 sm:p-6">
              <SecHead title="Liabilities & Equity" meta="what the business owes and owners' stake" className="px-0" />
              <div className="mt-4 space-y-6">
                <div>
                  <h3 className="micro-label mb-2">Liabilities</h3>
                  <ul className="space-y-1">
                    {data.liabilities.map((l) => (
                      <li key={l.id} className="flex items-baseline justify-between border-b border-black/[0.05] py-2.5 text-[14px]">
                        <span className="text-muted-foreground">
                          <span className="num mr-2 text-[12px]">{l.code}</span>
                          {l.name}
                        </span>
                        <span className="num">{fmtMoney(l.balance)}</span>
                      </li>
                    ))}
                    {data.liabilities.length === 0 && (
                      <li className="py-2 text-[13.5px] text-muted-foreground">No liabilities.</li>
                    )}
                  </ul>
                  <div className="num mt-2 flex justify-between border-t border-black/[0.08] pt-2.5 text-[14px] font-bold">
                    <span>Total Liabilities</span>
                    <span className="text-[#FF3B30]">{fmtMoney(data.totalLiabilities)}</span>
                  </div>
                </div>
                <div>
                  <h3 className="micro-label mb-2">Equity</h3>
                  <ul className="space-y-1">
                    {data.equity.map((e) => (
                      <li key={e.id} className="flex items-baseline justify-between border-b border-black/[0.05] py-2.5 text-[14px]">
                        <span className="text-muted-foreground">
                          <span className="num mr-2 text-[12px]">{e.code}</span>
                          {e.name}
                        </span>
                        <span className="num">{fmtMoney(e.balance)}</span>
                      </li>
                    ))}
                    <li className="flex items-baseline justify-between border-b border-black/[0.05] py-2.5 text-[14px]">
                      <span className="text-muted-foreground">Current-period Net Income</span>
                      <span className="num">{fmtMoney(data.netIncome)}</span>
                    </li>
                  </ul>
                  <div className="num mt-2 flex justify-between border-t border-black/[0.08] pt-2.5 text-[14px] font-bold">
                    <span>Total Equity</span>
                    <span>{fmtMoney(data.totalEquity)}</span>
                  </div>
                </div>
                <div className="num flex items-center justify-between rounded-[14px] bg-black/[0.03] p-4 text-[15px]">
                  <span className="font-bold">Liabilities + Equity</span>
                  <span className="font-bold">{fmtMoney(data.totalLiabilities + data.totalEquity)}</span>
                </div>
              </div>
            </Card>
          </FadeIn>

          <FadeIn delay={0.24} className="lg:col-span-2">
            <div
              className={cn(
                'flex items-center gap-3.5 rounded-[16px] border p-4.5 p-5',
                data.balanced ? 'border-[#34C759]/25 bg-[#34C759]/[0.06]' : 'border-[#FF3B30]/25 bg-[#FF3B30]/[0.05]'
              )}
            >
              {data.balanced ? (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#34C759]/15 text-[#248A3D]">
                  <CheckCircle2 className="h-5 w-5" strokeWidth={2} />
                </span>
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FF3B30]/12 text-[#FF3B30]">
                  <Scale className="h-5 w-5" strokeWidth={2} />
                </span>
              )}
              <div>
                <p className="text-[14.5px] font-bold tracking-[-0.01em]">
                  {data.balanced ? 'Balance sheet is balanced' : 'Balance sheet out of balance'}
                </p>
                <p className="num mt-0.5 text-[12.5px] text-muted-foreground">
                  Assets {fmtMoney(data.totalAssets)} {data.balanced ? '=' : '≠'} Liabilities + Equity{' '}
                  {fmtMoney(data.totalLiabilities + data.totalEquity)}
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      )}

      {/* ===== Trial Balance ===== */}
      {data.type === 'trial' && (
        <FadeIn delay={0.12}>
          <Card className="overflow-hidden py-0">
            <div className="px-5 pt-5">
              <SecHead title="Trial Balance" meta="all accounts with net debit or credit position" className="px-0" />
            </div>
            <div className="thin-scroll mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.06]">
                    <th scope="col" className={TH}>Code</th>
                    <th scope="col" className={TH}>Account</th>
                    <th scope="col" className={cn(TH, 'hidden sm:table-cell')}>Type</th>
                    <th scope="col" className={TH_R}>Debit</th>
                    <th scope="col" className={TH_R}>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.code} className="border-b border-black/[0.045] transition-colors last:border-0 hover:bg-black/[0.015]">
                      <td className="num px-4 py-3 text-[13px] text-muted-foreground">{r.code}</td>
                      <td className="px-4 py-3 text-[14px] font-medium">{r.name}</td>
                      <td className="hidden px-4 py-3 text-[13px] text-muted-foreground sm:table-cell">{r.type}</td>
                      <td className="num px-4 py-3 text-right text-[13.5px]">{r.debit ? fmtMoney(r.debit) : ''}</td>
                      <td className="num px-4 py-3 text-right text-[13.5px]">{r.credit ? fmtMoney(r.credit) : ''}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr
                    className={cn(
                      'border-t-2 font-semibold',
                      data.balanced ? 'border-black/[0.08] bg-[#34C759]/[0.05]' : 'border-[#FF3B30]/30 bg-[#FF3B30]/[0.04]'
                    )}
                  >
                    <td className="px-4 py-3.5" colSpan={3}>
                      <span className="flex items-center gap-2 text-[13px]">
                        {data.balanced && <CheckCircle2 className="h-4 w-4 text-[#248A3D]" strokeWidth={2} />}
                        Totals {data.balanced ? '(balanced)' : '(out of balance)'}
                      </span>
                    </td>
                    <td className="num px-4 py-3.5 text-right text-[14px]">{fmtMoney(data.totalDebit)}</td>
                    <td className="num px-4 py-3.5 text-right text-[14px]">{fmtMoney(data.totalCredit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </FadeIn>
      )}
    </div>
  );
}

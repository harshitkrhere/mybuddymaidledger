'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, ChevronRight, FileWarning, TrendingUp, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PLANS, PLAN_KEYS } from '@/lib/constants';
import {
  fmtMoney,
  FadeIn,
  SourceBadge,
  ErrorNote,
  KpiCard,
  SecHead,
  Card,
  EASE_APPLE,
  TH,
  TH_R,
} from './shared';
import { RevenueChart, type MonthPoint } from './chart';

interface DashboardData {
  period: { key: string; label: string };
  kpis: {
    cash: number;
    totalRevenue: number;
    totalExpenses: number;
    netIncome: number;
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    gstPayable: number;
    activePlans: number;
    activePlacements: number;
    availableHelpers: number;
    customerCount: number;
    salesInPeriod: number;
    monthRevenue: number;
  };
  months: MonthPoint[];
  planMix: { plan: string; count: number }[];
  cityMix: { city: string; count: number }[];
  cityOps: { city: string; customers: number; helpers: number; placements: number; revenue: number }[];
  expenseByCategory: { category: string; total: number }[];
  recentTransactions: {
    id: string;
    entryNumber: string;
    date: string;
    memo: string;
    source: string;
    amount: number;
    cashDelta: number;
    balance: number;
  }[];
}

const PERIODS = [
  { key: 'month' as const, label: 'This Month' },
  { key: 'fy' as const, label: 'This FY' },
  { key: 'all' as const, label: 'All Time' },
];

const PLAN_SWATCH: Record<string, string> = {
  SILVER: '#C7C7CC',
  GOLD: '#FF9500',
  DIAMOND: '#AF52DE',
};

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-[12px] bg-black/[0.06]', className)} />;
}

export function Dashboard({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<'month' | 'fy' | 'all'>('all');

  const load = async (p: 'month' | 'fy' | 'all') => {
    try {
      setError('');
      const res = await fetch(`/api/dashboard?period=${p}`);
      if (!res.ok) throw new Error('Failed to load dashboard');
      setData(await res.json());
    } catch {
      setError('Could not load the books. Please refresh.');
    }
  };

  useEffect(() => {
    load(period);
  }, [period]);

  if (error) return <ErrorNote message={error} />;

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[118px] rounded-[20px]" />
          ))}
        </div>
        <Skeleton className="h-[320px] rounded-[20px]" />
        <div className="grid gap-6 lg:grid-cols-[1.9fr_1fr]">
          <Skeleton className="h-[280px] rounded-[20px]" />
          <Skeleton className="h-[280px] rounded-[20px]" />
        </div>
      </div>
    );
  }

  const { kpis, months, planMix, cityOps, expenseByCategory, recentTransactions } = data;
  const periodLabel = data.period?.label ?? 'All time';

  // month-on-month note
  const last = months[months.length - 1];
  const prev = months[months.length - 2];
  let momNote = '';
  if (last && prev && prev.revenue > 0 && last.revenue > prev.revenue) {
    const pct = Math.round(((last.revenue - prev.revenue) / prev.revenue) * 100);
    momNote = `Up ${pct}% month-on-month — best month yet at ${fmtMoney(last.revenue, { compact: true })} booked in ${last.label}.`;
  } else if (last) {
    momNote = `Latest month booked ${fmtMoney(last.revenue, { compact: true })} across plans and services.`;
  }

  const totalActivePlans = planMix.reduce((s, p) => s + p.count, 0);
  const maxCityRevenue = Math.max(...cityOps.map((c) => c.revenue), 1);
  const maxExpense = Math.max(...expenseByCategory.map((c) => c.total), 1);

  return (
    <div className="space-y-6">
      {/* ============ period control ============ */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div
          role="group"
          aria-label="Dashboard period"
          className="inline-flex items-center rounded-[11px] bg-black/[0.05] p-[2px]"
        >
          {PERIODS.map((p) => {
            const active = period === p.key;
            return (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                aria-pressed={active}
                className="press relative rounded-[9px] px-3.5 py-[6px] text-[13px] font-medium sm:px-4"
              >
                {active && (
                  <motion.span
                    layoutId="period-pill"
                    transition={{ type: 'spring', stiffness: 500, damping: 44 }}
                    className="absolute inset-0 rounded-[9px] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.12)]"
                  />
                )}
                <span className={cn('relative z-10 whitespace-nowrap', active ? 'text-foreground' : 'text-muted-foreground')}>{p.label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[13px] text-muted-foreground">{periodLabel}</p>
      </div>

      {/* ============ KPI cards ============ */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <FadeIn delay={0.02}>
          <KpiCard
            label="Gross Revenue"
            value={fmtMoney(kpis.totalRevenue, { compact: true })}
            sub={`${kpis.salesInPeriod} plan sales · ${kpis.customerCount} households`}
            icon={<TrendingUp />}
          />
        </FadeIn>
        <FadeIn delay={0.08}>
          <KpiCard
            label="Net Income"
            value={fmtMoney(kpis.netIncome, { sign: true, compact: true })}
            sub={`Expenses ${fmtMoney(kpis.totalExpenses, { compact: true })}`}
            tone={kpis.netIncome >= 0 ? 'positive' : 'negative'}
            icon={kpis.netIncome >= 0 ? <ArrowUpRight /> : <ArrowDownRight />}
          />
        </FadeIn>
        <FadeIn delay={0.14}>
          <KpiCard
            label="Cash & Bank"
            value={fmtMoney(kpis.cash, { compact: true })}
            sub={`Assets ${fmtMoney(kpis.totalAssets, { compact: true })} · Equity ${fmtMoney(kpis.totalEquity, { compact: true })}`}
            icon={<Wallet />}
          />
        </FadeIn>
        <FadeIn delay={0.2}>
          <KpiCard
            label="GST Payable"
            value={fmtMoney(kpis.gstPayable, { compact: true })}
            sub="GSTR-3B due 20 Nov · output @ 18%"
            tone="warning"
            icon={<FileWarning />}
          />
        </FadeIn>
      </div>

      {/* ============ revenue chart ============ */}
      <FadeIn delay={0.12}>
        <Card className="p-4 pb-2 sm:p-6 sm:pb-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div>
              <h2 className="text-[17px] font-semibold tracking-[-0.015em]">Revenue vs Expenses</h2>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">Last six months {momNote ? `· ${momNote}` : ''}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground">
                <span className="h-[3px] w-5 rounded-full bg-[#0071E3]" /> Revenue
              </span>
              <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground">
                <span className="h-[3px] w-5 rounded-full bg-[#FF9500]" /> Expenses
              </span>
              <span
                className={cn(
                  'num hidden rounded-full px-2.5 py-[3px] text-[12px] font-semibold sm:inline-flex',
                  kpis.netIncome >= 0 ? 'bg-[#34C759]/12 text-[#248A3D]' : 'bg-[#FF3B30]/10 text-[#FF3B30]'
                )}
              >
                Net {fmtMoney(kpis.netIncome, { sign: true, compact: true })}
              </span>
            </div>
          </div>
          <div className="thin-scroll -mx-1 overflow-x-auto px-1">
            <RevenueChart months={months} />
          </div>
        </Card>
      </FadeIn>

      {/* ============ ledger + side column ============ */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.9fr)_minmax(280px,1fr)]">
        {/* recent ledger */}
        <FadeIn delay={0.16}>
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5">
              <SecHead title="Recent Activity" meta={`${recentTransactions.length} latest entries`} className="mb-0 px-0" />
              <button
                onClick={() => onNavigate?.('journal')}
                className="press flex shrink-0 items-center gap-0.5 text-[13px] font-semibold text-[#0071E3] hover:text-[#0077ED]"
              >
                View all <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
            <div className="thin-scroll mt-3 overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b border-black/[0.06]">
                    <th scope="col" className={TH}>Date</th>
                    <th scope="col" className={TH}>Ref</th>
                    <th scope="col" className={TH}>Particulars</th>
                    <th scope="col" className={TH_R}>In</th>
                    <th scope="col" className={TH_R}>Out</th>
                    <th scope="col" className={TH_R}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((t) => (
                    <tr key={t.id} className="border-b border-black/[0.04] transition-colors last:border-0 hover:bg-black/[0.015]">
                      <td className="num whitespace-nowrap px-4 py-3.5 text-[13px] text-muted-foreground">{fmtShortDate(t.date)}</td>
                      <td className="num whitespace-nowrap px-4 py-3.5 text-[13px] font-medium text-foreground/80">{t.entryNumber}</td>
                      <td className="max-w-[280px] px-4 py-3.5">
                        <span className="block truncate text-[14px] leading-tight">{t.memo}</span>
                        <span className="mt-1 inline-block">
                          <SourceBadge source={t.source} />
                        </span>
                      </td>
                      <td className="num whitespace-nowrap px-4 py-3.5 text-right text-[13.5px] text-[#248A3D]">
                        {t.cashDelta > 0 ? fmtMoney(t.cashDelta, { compact: true }) : <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="num whitespace-nowrap px-4 py-3.5 text-right text-[13.5px] text-[#C77C00]">
                        {t.cashDelta < 0 ? fmtMoney(Math.abs(t.cashDelta), { compact: true }) : <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="num whitespace-nowrap px-4 py-3.5 text-right text-[13.5px] font-semibold">{fmtMoney(t.balance, { compact: true })}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-black/[0.08]">
                    <td colSpan={5} className="px-4 py-3.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      Closing balance — Cash & Bank
                    </td>
                    <td className="num px-4 py-3.5 text-right text-[15px] font-bold">{fmtMoney(kpis.cash, { compact: true })}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </FadeIn>

        {/* right column */}
        <div className="space-y-6">
          {/* plan portfolio ring */}
          <FadeIn delay={0.22}>
            <Card className="p-5">
              <SecHead title="Plan Portfolio" meta={`${totalActivePlans} active`} className="px-0" />
              <div className="mt-1 flex items-center gap-5">
                <PlanRing planMix={planMix} total={totalActivePlans} />
                <ul className="min-w-0 flex-1 space-y-2.5">
                  {PLAN_KEYS.map((k) => {
                    const count = planMix.find((p) => p.plan === k)?.count ?? 0;
                    const pct = totalActivePlans ? Math.round((count / totalActivePlans) * 100) : 0;
                    return (
                      <li key={k} className="flex items-center gap-2.5">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PLAN_SWATCH[k] }} aria-hidden="true" />
                        <span className="text-[13px] font-medium capitalize text-foreground/85">{k.toLowerCase()}</span>
                        <span className="num ml-auto text-[13px] font-semibold">
                          {count} <span className="font-normal text-muted-foreground">· {pct}%</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </Card>
          </FadeIn>

          {/* expense breakdown */}
          <FadeIn delay={0.28}>
            <Card className="p-5">
              <SecHead title="Expenses" meta={`${periodLabel.toLowerCase()} · by category`} className="px-0" />
              <ul className="mt-1 space-y-3.5">
                {expenseByCategory.map((c) => (
                  <li key={c.category}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[13px] font-medium text-foreground/85">{c.category}</span>
                      <span className="num shrink-0 text-[13px] font-semibold">{fmtMoney(c.total, { compact: true })}</span>
                    </div>
                    <div className="mt-1.5 h-[6px] overflow-hidden rounded-full bg-black/[0.05]" aria-hidden="true">
                      <motion.i
                        className="block h-full rounded-full bg-[#FF9500]"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max((c.total / maxExpense) * 100, 3)}%` }}
                        transition={{ duration: 0.8, delay: 0.35, ease: EASE_APPLE }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => onNavigate?.('reports')}
                className="press mt-5 flex w-full items-start gap-3 rounded-[14px] bg-[#FF9500]/[0.08] p-3.5 text-left hover:bg-[#FF9500]/[0.13]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#FF9500]/15 text-[#C77C00]">
                  <FileWarning className="h-4 w-4" strokeWidth={2} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold text-[#9A6200]">GST filing reminder</span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-[#9A6200]/85">
                    {fmtMoney(kpis.gstPayable)} output GST payable — GSTR-3B due 20 Nov. See the balance sheet for the full liability position.
                  </span>
                </span>
              </button>
            </Card>
          </FadeIn>
        </div>
      </div>

      {/* ============ operations + city ============ */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <FadeIn delay={0.2}>
          <Card className="grid grid-cols-2 sm:grid-cols-4">
            {[
              { n: kpis.salesInPeriod, l: 'Plan Sales', s: `in ${periodLabel.toLowerCase()}` },
              { n: kpis.customerCount, l: 'Customers', s: 'households on the books' },
              { n: kpis.availableHelpers, l: 'Verified Helpers', s: 'checks complete' },
              { n: kpis.activePlacements, l: 'Active Placements', s: 'helpers in homes' },
            ].map((cell, i) => (
              <div key={cell.l} className={cn('p-5', i > 0 && 'border-l border-black/[0.05]', i >= 2 && 'border-t border-black/[0.05] sm:border-t-0', i === 2 && 'sm:border-t', i === 3 && 'sm:border-t')}>
                <p className="num text-[30px] font-bold leading-none tracking-[-0.02em] text-foreground">{cell.n}</p>
                <p className="mt-2 text-[12.5px] font-medium text-foreground/80">{cell.l}</p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">{cell.s}</p>
              </div>
            ))}
          </Card>
        </FadeIn>

        <FadeIn delay={0.26}>
          <Card className="p-5">
            <SecHead title="City Operations" meta={`${cityOps.length} cities · all-time plan revenue`} className="px-0" />
            <ul className="mt-1 space-y-4">
              {cityOps.map((c, i) => (
                <li key={c.city}>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <span className="text-[13.5px] font-semibold tracking-[-0.01em]">
                      {c.city}
                      {i === 0 && (
                        <span className="ml-2 rounded-full bg-[#0071E3]/10 px-2 py-[1px] align-middle text-[10px] font-bold uppercase tracking-[0.04em] text-[#0071E3]">HQ</span>
                      )}
                    </span>
                    <span className="text-[11.5px] text-muted-foreground">
                      {c.customers} households · {c.helpers} helpers · {c.placements} placed
                    </span>
                    <span className="num ml-auto text-[13.5px] font-semibold">{fmtMoney(c.revenue, { compact: true })}</span>
                  </div>
                  <div className="mt-1.5 h-[6px] overflow-hidden rounded-full bg-black/[0.05]" aria-hidden="true">
                    <motion.i
                      className="block h-full rounded-full bg-gradient-to-r from-[#3E9BFF] to-[#0071E3]"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max((c.revenue / maxCityRevenue) * 100, 3)}%` }}
                      transition={{ duration: 0.8, delay: 0.4 + i * 0.06, ease: EASE_APPLE }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </FadeIn>
      </div>
    </div>
  );
}

function fmtShortDate(d: string): string {
  const date = new Date(d);
  return `${String(date.getDate()).padStart(2, '0')} ${date.toLocaleDateString('en-IN', { month: 'short' })}`;
}

// =============================
// Activity-ring style plan mix (Apple Fitness flavor)
// =============================

function PlanRing({ planMix, total }: { planMix: { plan: string; count: number }[]; total: number }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const segments = useMemo(() => {
    const GAP = total > 0 ? C * 0.02 : 0;
    const segs: { color: string; len: number; offset: number }[] = [];
    let acc = 0;
    for (const k of PLAN_KEYS) {
      const count = planMix.find((p) => p.plan === k)?.count ?? 0;
      const share = total > 0 ? count / total : 0;
      const len = Math.max(share * C - (share > 0 ? GAP : 0), 0);
      segs.push({ color: PLAN_SWATCH[k], len, offset: acc });
      acc += share * C;
    }
    return segs.filter((s) => s.len > 0);
  }, [planMix, total, C]);

  return (
    <div className="relative h-[132px] w-[132px] shrink-0" role="img" aria-label={`${total} active plans`}>
      <svg viewBox="0 0 132 132" className="h-full w-full -rotate-90">
        <circle cx="66" cy="66" r={R} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="13" />
        {segments.map((s, i) => (
          <motion.circle
            key={i}
            cx="66"
            cy="66"
            r={R}
            fill="none"
            stroke={s.color}
            strokeWidth="13"
            strokeLinecap="round"
            strokeDasharray={`${Math.max(s.len - 2, 1)} ${C}`}
            initial={{ strokeDashoffset: -s.offset + C * 0.001 }}
            animate={{ strokeDashoffset: -s.offset }}
            transition={{ duration: 1, delay: 0.3 + i * 0.12, ease: EASE_APPLE }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="num text-[28px] font-bold leading-none tracking-[-0.02em]">{total}</span>
        <span className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">active</span>
      </div>
    </div>
  );
}

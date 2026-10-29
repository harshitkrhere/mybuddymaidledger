'use client';

import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================
// Formatting helpers — INR
// =============================

export function fmtMoney(n: number | null | undefined, opts?: { sign?: boolean; compact?: boolean }): string {
  if (n == null || isNaN(n)) return '—';
  const { sign = false, compact = false } = opts || {};
  const abs = Math.abs(n);
  let body: string;
  if (compact && abs >= 1000) {
    body = new Intl.NumberFormat('en-IN', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(abs);
  } else {
    body = abs.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  const prefix = n < 0 ? '−' : sign ? '+' : '';
  return `${prefix}₹${body}`;
}

export function fmtDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function fmtMonth(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

export function toInputDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// =============================
// Motion helpers
// =============================

export const EASE_APPLE: [number, number, number, number] = [0.32, 0.72, 0, 1];

export function FadeIn({
  children,
  className,
  delay = 0,
  y = 14,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: EASE_APPLE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// =============================
// iOS tinted pills
// =============================

const PILL = 'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold leading-[1.35] tracking-[-0.005em]';

const TYPE_PILL: Record<string, string> = {
  ASSET: 'bg-[#0071E3]/10 text-[#0071E3]',
  LIABILITY: 'bg-[#FF3B30]/10 text-[#FF3B30]',
  EQUITY: 'bg-[#AF52DE]/10 text-[#AF52DE]',
  REVENUE: 'bg-[#34C759]/12 text-[#248A3D]',
  EXPENSE: 'bg-[#FF9500]/12 text-[#C77C00]',
};

export function AccountTypeBadge({ type }: { type: string }) {
  return <span className={cn(PILL, TYPE_PILL[type] || 'bg-black/[0.05] text-muted-foreground')}>{type}</span>;
}

const PLAN_PILL: Record<string, string> = {
  SILVER: 'bg-black/[0.06] text-[#48484A]',
  GOLD: 'bg-[#FF9500]/12 text-[#C77C00]',
  DIAMOND: 'bg-[#AF52DE]/10 text-[#AF52DE]',
};

export function PlanBadge({ plan }: { plan: string }) {
  return <span className={cn(PILL, 'capitalize', PLAN_PILL[plan] || 'bg-black/[0.05] text-muted-foreground')}>{plan.toLowerCase()}</span>;
}

const CUST_PILL: Record<string, string> = {
  ACTIVE: 'bg-[#34C759]/12 text-[#248A3D]',
  EXPIRED: 'bg-black/[0.06] text-[#8E8E93]',
  REFUNDED: 'bg-[#FF3B30]/10 text-[#FF3B30]',
};

export function CustomerStatusBadge({ status }: { status: string }) {
  return <span className={cn(PILL, 'capitalize', CUST_PILL[status] || 'bg-black/[0.05] text-muted-foreground')}>{status.toLowerCase()}</span>;
}

const HELPER_PILL: Record<string, string> = {
  VERIFIED: 'bg-[#0071E3]/10 text-[#0071E3]',
  PLACED: 'bg-[#34C759]/12 text-[#248A3D]',
  PENDING: 'bg-[#FF9500]/12 text-[#C77C00]',
  INACTIVE: 'bg-black/[0.06] text-[#8E8E93]',
};

export function HelperStatusBadge({ status }: { status: string }) {
  return <span className={cn(PILL, 'capitalize', HELPER_PILL[status] || 'bg-black/[0.05] text-muted-foreground')}>{status.toLowerCase()}</span>;
}

const PLACE_PILL: Record<string, string> = {
  ACTIVE: 'bg-[#34C759]/12 text-[#248A3D]',
  ENDED: 'bg-black/[0.06] text-[#8E8E93]',
  REPLACED: 'bg-[#FF9500]/12 text-[#C77C00]',
};

export function PlacementStatusBadge({ status }: { status: string }) {
  return <span className={cn(PILL, 'capitalize', PLACE_PILL[status] || 'bg-black/[0.05] text-muted-foreground')}>{status.toLowerCase()}</span>;
}

const SOURCE_PILL: Record<string, string> = {
  MANUAL: 'bg-black/[0.06] text-[#8E8E93]',
  PLAN_SALE: 'bg-[#34C759]/12 text-[#248A3D]',
  EXPENSE: 'bg-[#FF9500]/12 text-[#C77C00]',
  REFUND: 'bg-[#FF3B30]/10 text-[#FF3B30]',
  OPENING: 'bg-[#AF52DE]/10 text-[#AF52DE]',
};

export function SourceBadge({ source }: { source: string }) {
  return (
    <span className={cn(PILL, 'capitalize', SOURCE_PILL[source] || 'bg-black/[0.05] text-muted-foreground')}>
      {source.replaceAll('_', ' ').toLowerCase()}
    </span>
  );
}

// =============================
// Section header — iOS Settings style
// =============================

export function SecHead({
  title,
  meta,
  action,
  className,
}: {
  title: string;
  meta?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 px-1', className)}>
      <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-foreground">{title}</h2>
      {meta && <span className="text-[12.5px] text-muted-foreground">{meta}</span>}
      {action && <div className="ml-auto flex items-center gap-2">{action}</div>}
    </div>
  );
}

// =============================
// Loading & empty states
// =============================

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[20px] border border-black/[0.06] bg-card py-20 card-shadow">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" strokeWidth={2} />
      <p className="text-[13.5px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[20px] border border-dashed border-black/[0.1] py-16 text-center">
      <p className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">{title}</p>
      {hint && <p className="max-w-sm text-[13px] text-muted-foreground">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[16px] border border-[#FF3B30]/20 bg-[#FF3B30]/[0.05] px-4 py-3.5 text-[14px] font-medium text-[#D70015]">
      {message}
    </div>
  );
}

// =============================
// Cards & stats
// =============================

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('card-shadow rounded-[20px] border border-black/[0.06] bg-card', className)}>{children}</div>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  tone = 'default',
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'positive' | 'negative' | 'warning';
  icon?: React.ReactNode;
}) {
  const valueTone = {
    default: 'text-foreground',
    positive: 'text-[#248A3D]',
    negative: 'text-[#FF3B30]',
    warning: 'text-[#C77C00]',
  };
  return (
    <div className="card-shadow press rounded-[20px] border border-black/[0.06] bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        {icon && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-black/[0.04] text-muted-foreground [&>svg]:h-[15px] [&>svg]:w-[15px]">
            {icon}
          </span>
        )}
      </div>
      <p className={cn('num mt-2 text-[26px] font-bold leading-none tracking-[-0.02em] sm:text-[28px]', valueTone[tone])}>{value}</p>
      {sub && <p className="mt-2 text-[13px] leading-snug text-foreground/60">{sub}</p>}
    </div>
  );
}

export function MiniStat({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
      <p className="num mt-1 text-[24px] font-bold leading-none tracking-[-0.02em] text-foreground">{value}</p>
      {sub && <p className="mt-1.5 text-[12px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// Avatar with initials — Apple gradient
export function Avatar({
  name,
  size = 40,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div
      className={cn('flex shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-b from-[#5AC8FA] to-[#0A84FF] font-semibold text-white', className)}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.34) }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

// table header cell — micro caps, Apple style
export const TH = 'px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground';
export const TH_R = 'px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground';

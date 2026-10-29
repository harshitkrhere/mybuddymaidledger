'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { fmtMoney, EASE_APPLE } from './shared';

// =============================
// Revenue vs Expenses — Apple-style series chart
// smooth curves, gradient fills, animated draw, hover crosshair
// =============================

export interface MonthPoint {
  key: string;
  label: string;
  revenue: number;
  expenses: number;
}

const W = 900;
const H = 280;
const PAD = { l: 52, r: 44, t: 26, b: 36 };
const BLUE = '#0071E3';
const ORANGE = '#FF9500';

function niceCeil(v: number): number {
  if (v <= 0) return 75_000;
  const step = v > 500_000 ? 100_000 : v > 250_000 ? 50_000 : v > 100_000 ? 25_000 : 15_000;
  return Math.ceil(v / step) * step;
}

function fmtK(v: number): string {
  if (v >= 100_000) return `${(v / 100_000).toFixed(v >= 1_000_000 ? 0 : 1).replace(/\.0$/, '')}L`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}K`;
  return `${v}`;
}

/** Catmull-Rom → cubic bezier for silky-smooth curves */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return pts.length ? `M${pts[0].x},${pts[0].y}` : '';
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

export function RevenueChart({ months, className }: { months: MonthPoint[]; className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  if (!months.length) return null;

  const n = months.length;
  const stepX = n > 1 ? (W - PAD.l - PAD.r) / (n - 1) : 0;
  const x = (i: number) => PAD.l + i * stepX;
  const maxV = niceCeil(Math.max(...months.map((m) => Math.max(m.revenue, m.expenses)), 1));
  const y = (v: number) => H - PAD.b - (v / maxV) * (H - PAD.t - PAD.b);

  const revPts = months.map((m, i) => ({ x: x(i), y: y(m.revenue) }));
  const expPts = months.map((m, i) => ({ x: x(i), y: y(m.expenses) }));

  const revLine = smoothPath(revPts);
  const expLine = smoothPath(expPts);
  const baseY = H - PAD.b;
  const revArea = `${revLine} L${revPts[n - 1].x},${baseY} L${revPts[0].x},${baseY} Z`;
  const expArea = `${expLine} L${expPts[n - 1].x},${baseY} L${expPts[0].x},${baseY} Z`;

  const gridLevels = [0, 1, 2, 3, 4].map((i) => (maxV / 4) * i);
  const lastRev = revPts[n - 1];
  const lastExp = expPts[n - 1];
  const lastM = months[n - 1];

  const onPointerMove = (e: React.PointerEvent) => {
    const svg = wrapRef.current?.querySelector('svg');
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(x(i) - vx);
      if (d < best) {
        best = d;
        nearest = i;
      }
    }
    setHover(nearest);
  };

  // tooltip positioning in viewBox coords → percentage for HTML overlay
  const hx = hover != null ? x(hover) : 0;
  const tooltipLeft = `${(hx / W) * 100}%`;
  const flip = hx > W * 0.62;
  const hm = hover != null ? months[hover] : null;
  const net = hm ? hm.revenue - hm.expenses : 0;

  return (
    <div
      ref={wrapRef}
      className={cn('relative select-none', className)}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setHover(null)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Revenue versus expenses, ${months[0].label} to ${months[n - 1].label}`} className="block h-auto w-full min-w-[540px]">
        <defs>
          <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BLUE} stopOpacity="0.16" />
            <stop offset="100%" stopColor={BLUE} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="expFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ORANGE} stopOpacity="0.10" />
            <stop offset="100%" stopColor={ORANGE} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* gridlines */}
        <g stroke="rgba(0,0,0,0.055)" strokeWidth="1">
          {gridLevels.map((v) => (
            <line key={v} x1={PAD.l} y1={y(v)} x2={W - PAD.r} y2={y(v)} />
          ))}
        </g>
        <g fontSize="11.5" fill="#8E8E93" textAnchor="end" className="num">
          {gridLevels.map((v) => (
            <text key={v} x={PAD.l - 12} y={y(v) + 4}>
              ₹{fmtK(v)}
            </text>
          ))}
        </g>

        {/* month labels */}
        <g fontSize="12" fill="#8E8E93" textAnchor="middle" fontWeight="500">
          {months.map((m, i) => (
            <text key={m.key} x={x(i)} y={H - 10} opacity={hover == null || hover === i ? 1 : 0.55}>
              {m.label}
            </text>
          ))}
        </g>

        {/* hover crosshair */}
        {hover != null && (
          <line x1={x(hover)} y1={PAD.t - 6} x2={x(hover)} y2={baseY} stroke="rgba(0,0,0,0.16)" strokeWidth="1" strokeDasharray="1 4" strokeLinecap="round" />
        )}

        {/* areas */}
        <motion.path d={revArea} fill="url(#revFill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, delay: 0.5 }} />
        <motion.path d={expArea} fill="url(#expFill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, delay: 0.65 }} />

        {/* lines — animated draw */}
        <motion.path
          d={expLine}
          fill="none"
          stroke={ORANGE}
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, delay: 0.15, ease: EASE_APPLE }}
        />
        <motion.path
          d={revLine}
          fill="none"
          stroke={BLUE}
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.3, ease: EASE_APPLE }}
        />

        {/* endpoint dots */}
        <motion.g initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.1, duration: 0.35, ease: EASE_APPLE }} style={{ transformOrigin: `${lastExp.x}px ${lastExp.y}px` }}>
          <circle cx={lastExp.x} cy={lastExp.y} r="4.5" fill="#fff" stroke={ORANGE} strokeWidth="2.5" />
        </motion.g>
        <motion.g initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.25, duration: 0.35, ease: EASE_APPLE }} style={{ transformOrigin: `${lastRev.x}px ${lastRev.y}px` }}>
          <circle cx={lastRev.x} cy={lastRev.y} r="5" fill="#fff" stroke={BLUE} strokeWidth="2.75" />
        </motion.g>

        {/* endpoint value labels */}
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.35, duration: 0.4 }}>
          <text x={lastRev.x + 14} y={lastRev.y + 4} fontSize="13" fontWeight="700" fill={BLUE} className="num" textAnchor={lastRev.x > W - 120 ? 'end' : 'start'} dx={lastRev.x > W - 120 ? -26 : 0}>
            ₹{fmtK(lastM.revenue)}
          </text>
          <text x={lastExp.x + 14} y={lastExp.y + 4} fontSize="13" fontWeight="700" fill="#C77C00" className="num" textAnchor={lastExp.x > W - 120 ? 'end' : 'start'} dx={lastExp.x > W - 120 ? -26 : 0}>
            ₹{fmtK(lastM.expenses)}
          </text>
        </motion.g>

        {/* hover dots */}
        {hover != null && (
          <g>
            <circle cx={x(hover)} cy={y(months[hover].revenue)} r="5.5" fill="#fff" stroke={BLUE} strokeWidth="2.75" />
            <circle cx={x(hover)} cy={y(months[hover].expenses)} r="5" fill="#fff" stroke={ORANGE} strokeWidth="2.5" />
          </g>
        )}
      </svg>

      {/* hover tooltip — HTML overlay */}
      {hm && (
        <div
          className="pointer-events-none absolute top-0 z-10"
          style={{ left: tooltipLeft, transform: flip ? 'translateX(-108%)' : 'translateX(8%)' }}
        >
          <div className="rounded-[14px] border border-black/[0.06] bg-white/95 px-3.5 py-2.5 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.25)] backdrop-blur-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">{hm.label}</p>
            <div className="mt-1.5 space-y-1">
              <p className="flex items-center gap-2 text-[13px]">
                <span className="h-2 w-2 rounded-full" style={{ background: BLUE }} />
                <span className="text-muted-foreground">Revenue</span>
                <span className="num ml-auto pl-3 font-semibold">{fmtMoney(hm.revenue, { compact: true })}</span>
              </p>
              <p className="flex items-center gap-2 text-[13px]">
                <span className="h-2 w-2 rounded-full" style={{ background: ORANGE }} />
                <span className="text-muted-foreground">Expenses</span>
                <span className="num ml-auto pl-3 font-semibold">{fmtMoney(hm.expenses, { compact: true })}</span>
              </p>
              <p className="flex items-center gap-2 border-t border-black/[0.06] pt-1 text-[13px]">
                <span className="text-muted-foreground">Net</span>
                <span className={cn('num ml-auto pl-3 font-semibold', net >= 0 ? 'text-[#248A3D]' : 'text-[#FF3B30]')}>
                  {fmtMoney(net, { sign: true, compact: true })}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

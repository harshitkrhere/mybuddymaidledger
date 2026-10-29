"use client"

// ============================================================
// Reports — P&L, category breakdown, cash-flow, CSV export.
// ============================================================

import { useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Download, TrendingDown, TrendingUp, Wallet } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorNote, fmtMoney, KpiCard, PageHeader, useApi, useCompany } from "./shared"

type ReportResponse = {
  range: { from: string; to: string }
  summary: { totalIncome: number; totalExpense: number; net: number; margin: number; transactions: number }
  incomeByCategory: { name: string; amount: number }[]
  expenseByCategory: { name: string; amount: number }[]
  monthly: { month: string; income: number; expense: number; net: number }[]
}

const PIE_COLORS = ["#0071e3", "#34c759", "#ff9500", "#af52de", "#ff3b30", "#5ac8fa", "#ff2d55", "#ffcc00"]

function presetRange(preset: string): { from: string; to: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  switch (preset) {
    case "thisMonth":
      return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) }
    case "lastMonth":
      return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) }
    case "thisQuarter":
      return { from: iso(new Date(y, Math.floor(m / 3) * 3, 1)), to: iso(new Date(y, Math.floor(m / 3) * 3 + 3, 0)) }
    case "lastQuarter":
      return { from: iso(new Date(y, Math.floor(m / 3) * 3 - 3, 1)), to: iso(new Date(y, Math.floor(m / 3) * 3, 0)) }
    default:
      return { from: iso(new Date(y, 0, 1)), to: iso(new Date(y, 11, 31)) }
  }
}

export function ReportsView() {
  const { currency } = useCompany()
  const [preset, setPreset] = useState("thisYear")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")

  const range = useMemo(() => {
    if (customFrom || customTo) {
      return { from: customFrom || presetRange("thisYear").from, to: customTo || presetRange("thisYear").to }
    }
    return presetRange(preset)
  }, [preset, customFrom, customTo])

  const url = useMemo(() => `/api/reports?from=${range.from}&to=${range.to}`, [range.from, range.to])
  const { data, loading, error } = useApi<ReportResponse>(url)

  function exportCsv() {
    window.open(`/api/reports?from=${range.from}&to=${range.to}&format=csv`, "_blank")
    toast.success("Preparing your CSV…")
  }

  const PRESETS = [
    { id: "thisMonth", label: "This month" },
    { id: "lastMonth", label: "Last month" },
    { id: "thisQuarter", label: "This quarter" },
    { id: "thisYear", label: "This year" },
  ]

  const expenseTotal = data?.summary.totalExpense ?? 0
  const expensePie = (data?.expenseByCategory ?? []).map((c) => ({
    name: c.name,
    value: c.amount,
    share: expenseTotal > 0 ? (c.amount / expenseTotal) * 100 : 0,
  }))

  return (
    <div>
      <PageHeader title="Reports" subtitle="Profit & loss, categories and cash-flow.">
        <Button variant="outline" onClick={exportCsv} className="press h-10 rounded-full px-5 gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </PageHeader>

      {/* Range selector */}
      <div className="card-shadow mb-6 flex flex-wrap items-center gap-2.5 rounded-2xl border bg-card p-3">
        <div className="flex flex-wrap rounded-lg bg-muted p-0.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => { setPreset(p.id); setCustomFrom(""); setCustomTo("") }}
              className={cn(
                "press rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-all",
                preset === p.id && !customFrom && !customTo ? "bg-white text-foreground shadow-sm dark:bg-zinc-800" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-9 w-[136px] rounded-lg bg-muted/50 border-transparent" aria-label="From date" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-9 w-[136px] rounded-lg bg-muted/50 border-transparent" aria-label="To date" />
        </div>
        <span className="ml-auto text-[12px] text-muted-foreground">
          {new Date(range.from).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} — {new Date(range.to).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </span>
      </div>

      {error && <ErrorNote message={error} />}

      {loading && !data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[118px] rounded-2xl" />)}
          </div>
          <Skeleton className="h-[360px] rounded-2xl" />
        </div>
      ) : !data ? null : (
        <div className="space-y-6">
          {/* P&L summary */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <KpiCard label="Income" value={fmtMoney(data.summary.totalIncome, currency)} icon={TrendingUp} tone="green" />
            <KpiCard label="Expenses" value={fmtMoney(data.summary.totalExpense, currency)} icon={TrendingDown} tone="red" />
            <KpiCard label="Net profit" value={fmtMoney(data.summary.net, currency)} icon={Wallet} tone={data.summary.net >= 0 ? "blue" : "red"} hint={`${data.summary.margin.toFixed(1)}% margin`} />
            <KpiCard label="Entries" value={String(data.summary.transactions)} icon={Wallet} tone="violet" hint="in selected range" />
          </div>

          {/* Cash-flow + category breakdown */}
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="card-shadow rounded-2xl border bg-card p-6 lg:col-span-3">
              <h2 className="text-[17px] font-semibold tracking-tight">Cash-flow by month</h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">Income vs expenses in the selected range</p>
              <div className="mt-4 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthly} margin={{ top: 6, right: 6, left: -12, bottom: 0 }} barGap={3}>
                    <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.06)" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} dy={8} />
                    <YAxis
                      tickLine={false} axisLine={false}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      tickFormatter={(v: number) => (v >= 100000 ? `${Math.round(v / 100000)}L` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                      width={44}
                    />
                    <Tooltip content={<FlowTip currency={currency} />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                    <Bar dataKey="income" fill="#34c759" radius={[5, 5, 0, 0]} maxBarSize={26} animationDuration={700} />
                    <Bar dataKey="expense" fill="#ff3b30" radius={[5, 5, 0, 0]} maxBarSize={26} animationDuration={700} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card-shadow rounded-2xl border bg-card p-6 lg:col-span-2">
              <h2 className="text-[17px] font-semibold tracking-tight">Where it goes</h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">Expenses by category</p>
              {expensePie.length === 0 ? (
                <p className="mt-8 text-center text-[13px] text-muted-foreground">No expenses in this range.</p>
              ) : (
                <>
                  <div className="mt-2 h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={expensePie} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2} strokeWidth={0} animationDuration={700}>
                          {expensePie.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<PieTip currency={currency} />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {expensePie.slice(0, 5).map((c, i) => (
                      <div key={c.name} className="flex items-center justify-between text-[12.5px]">
                        <span className="flex items-center gap-2 truncate">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="truncate">{c.name}</span>
                        </span>
                        <span className="num shrink-0 font-semibold">{fmtMoney(c.value, currency)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* P&L table */}
          <div className="card-shadow overflow-hidden rounded-2xl border bg-card">
            <div className="px-5 pt-5 pb-4">
              <h2 className="text-[17px] font-semibold tracking-tight">Profit &amp; loss</h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">Category-level breakdown</p>
            </div>
            <div className="grid gap-0 md:grid-cols-2 md:divide-x divide-border/50">
              <CategoryList title="Income" items={data.incomeByCategory} total={data.summary.totalIncome} currency={currency} positive />
              <CategoryList title="Expenses" items={data.expenseByCategory} total={data.summary.totalExpense} currency={currency} />
            </div>
            <div className="flex items-center justify-between border-t bg-muted/30 px-5 py-4">
              <span className="text-[15px] font-semibold">Net profit</span>
              <span className={cn("num text-[17px] font-bold", data.summary.net >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                {fmtMoney(data.summary.net, currency)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CategoryList({ title, items, total, currency, positive }: { title: string; items: { name: string; amount: number }[]; total: number; currency: string; positive?: boolean }) {
  return (
    <div className="border-t border-border/50 md:border-t-0">
      <p className="micro-label border-b border-border/40 bg-muted/25 px-5 py-2.5">{title}</p>
      {items.length === 0 ? (
        <p className="px-5 py-6 text-[13px] text-muted-foreground">Nothing recorded.</p>
      ) : (
        <div className="divide-y divide-border/40">
          {items.map((c) => {
            const share = total > 0 ? (c.amount / total) * 100 : 0
            return (
              <div key={c.name} className="px-5 py-3">
                <div className="flex items-center justify-between text-[13.5px]">
                  <span className="font-medium">{c.name}</span>
                  <span className={cn("num font-semibold", positive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                    {positive ? "+" : "−"}{fmtMoney(c.amount, currency)}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2.5">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", positive ? "bg-green-500" : "bg-red-500")}
                      style={{ width: `${Math.min(100, share)}%`, transition: "width 0.6s cubic-bezier(0.32,0.72,0,1)" }}
                    />
                  </div>
                  <span className="num w-11 text-right text-[11px] text-muted-foreground">{share.toFixed(1)}%</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div className="flex items-center justify-between border-t bg-muted/25 px-5 py-3 text-[14px] font-semibold">
        <span>Total {title.toLowerCase()}</span>
        <span className="num">{fmtMoney(total, currency)}</span>
      </div>
    </div>
  )
}

function FlowTip({ active, payload, label, currency }: { active?: boolean; payload?: { name: string; value: number }[]; label?: string; currency?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass rounded-xl border border-black/8 px-3.5 py-2.5 text-xs shadow-lg dark:border-white/10">
      <p className="mb-1.5 font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="num flex items-center justify-between gap-5">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className={cn("h-1.5 w-1.5 rounded-full", p.name === "income" ? "bg-green-500" : "bg-red-500")} />
            {p.name === "income" ? "Income" : "Expense"}
          </span>
          <span className="font-semibold">{fmtMoney(p.value, currency)}</span>
        </p>
      ))}
    </div>
  )
}

function PieTip({ active, payload, currency }: { active?: boolean; payload?: { name: string; value: number; payload: { share: number } }[]; currency?: string }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="glass rounded-xl border border-black/8 px-3.5 py-2 text-xs shadow-lg dark:border-white/10">
      <p className="font-semibold">{p.name}</p>
      <p className="num mt-1 text-muted-foreground">
        {fmtMoney(p.value, currency)} · {p.payload.share.toFixed(1)}%
      </p>
    </div>
  )
}

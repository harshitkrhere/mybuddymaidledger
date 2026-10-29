"use client"

// ============================================================
// Dashboard — the role-aware home view.
// Finance roles see the company picture; employees see their
// own expense activity. Approvals can be handled inline.
// ============================================================

import { useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Hourglass,
  Landmark,
  PieChart as PieIcon,
  Receipt,
  Send,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import {
  api,
  EmptyState,
  ErrorNote,
  expenseTone,
  fmtDate,
  fmtMoney,
  KpiCard,
  PageHeader,
  Pill,
  useApi,
  useCompany,
  type ExpenseT,
  type Me,
  type TransactionT,
} from "./shared"

type CompanyDashboard = {
  scope: "company"
  kpis: { revenue: number; expenses: number; net: number; cash: number; receivables: number; pendingPayouts: number }
  series: { month: string; income: number; expense: number }[]
  recentTransactions: (TransactionT & { client: { name: string } | null })[]
  pendingApprovals: (ExpenseT & { amountLabel: number })[]
  pendingApprovalsTotal: number
  invoices: { draft: number; sent: number; paid: number; paidAmount: number }
  topExpenseCategories: { name: string; amount: number }[]
}

type PersonalDashboard = {
  scope: "personal"
  kpis: { totalSubmitted: number; pending: number; approved: number; rejected: number; approvedAmount: number; thisMonthApproved: number }
  recentExpenses: ExpenseT[]
}

export function DashboardView({ me, onMutation }: { me: Me; onMutation: () => void }) {
  const { data, loading, error, reload } = useApi<CompanyDashboard | PersonalDashboard>("/api/dashboard")
  const { currency } = useCompany()
  const [reviewing, setReviewing] = useState<string | null>(null)

  const isCompany = data?.scope === "company"

  async function review(expenseId: string, status: "APPROVED" | "REJECTED") {
    if (reviewing) return
    setReviewing(expenseId)
    try {
      await api(`/api/expenses/${expenseId}`, "PATCH", { action: "review", status })
      toast.success(status === "APPROVED" ? "Expense approved" : "Expense rejected")
      await reload()
      onMutation()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save review.")
    } finally {
      setReviewing(null)
    }
  }

  return (
    <div>
      <PageHeader
        title={`Good ${greeting()}, ${me.user.name.split(" ")[0]}`}
        subtitle={isCompany ? "Here's the financial picture." : "Here's your expense activity."}
      />

      {error && <ErrorNote message={error} />}

      {loading && !data ? (
        <DashboardSkeleton personal={!me.capabilities.canApproveExpenses} />
      ) : !data ? null : isCompany ? (
        <CompanyBody d={data as CompanyDashboard} currency={currency} reviewing={reviewing} review={review} />
      ) : (
        <PersonalBody d={data as PersonalDashboard} currency={currency} />
      )}
    </div>
  )
}

// ============================================================
// Company view
// ============================================================

function CompanyBody({
  d,
  currency,
  reviewing,
  review,
}: {
  d: CompanyDashboard
  currency: string
  reviewing: string | null
  review: (id: string, status: "APPROVED" | "REJECTED") => void
}) {
  const chartData = d.series.map((s) => ({ ...s, net: s.income - s.expense }))

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Revenue · MTD" value={fmtMoney(d.kpis.revenue, currency)} icon={TrendingUp} tone="green" loading={false} />
        <KpiCard label="Expenses · MTD" value={fmtMoney(d.kpis.expenses, currency)} icon={TrendingDown} tone="red" />
        <KpiCard label="Net · MTD" value={fmtMoney(d.kpis.net, currency)} icon={Landmark} tone={d.kpis.net >= 0 ? "blue" : "red"} />
        <KpiCard label="Cash balance" value={fmtMoney(d.kpis.cash, currency)} icon={Banknote} tone="blue" />
        <KpiCard label="Receivables" value={fmtMoney(d.kpis.receivables, currency)} icon={Send} tone="orange" />
        <KpiCard label="Pending payouts" value={fmtMoney(d.kpis.pendingPayouts, currency)} icon={Hourglass} tone="violet" />
      </div>

      {/* Chart + invoice summary */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card-shadow rounded-2xl border bg-card p-6 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-[17px] font-semibold tracking-tight">Revenue vs expenses</h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">Last 12 months</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-500" /> Income</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> Expense</span>
            </div>
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34c759" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#34c759" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff3b30" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#ff3b30" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} dy={8} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v: number) => (v >= 100000 ? `${Math.round(v / 100000)}L` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                  width={44}
                />
                <Tooltip content={<ChartTip currency={currency} />} />
                <Area type="monotone" dataKey="income" stroke="#34c759" strokeWidth={2} fill="url(#incomeFill)" animationDuration={700} />
                <Area type="monotone" dataKey="expense" stroke="#ff3b30" strokeWidth={2} fill="url(#expenseFill)" animationDuration={700} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Invoice health */}
        <div className="card-shadow flex flex-col rounded-2xl border bg-card p-6">
          <h2 className="text-[17px] font-semibold tracking-tight">Invoices</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Billing health</p>

          <div className="mt-5 space-y-3">
            <InvoiceRow icon={FileText} tone="gray" label="Drafts" count={d.invoices.draft} />
            <InvoiceRow icon={Send} tone="blue" label="Sent · outstanding" count={d.invoices.sent} />
            <InvoiceRow icon={CheckCircle2} tone="green" label="Paid" count={d.invoices.paid} amount={d.invoices.paidAmount} currency={currency} />
          </div>

          <div className="mt-auto pt-6">
            <p className="micro-label mb-2.5">Top expenses · this month</p>
            <div className="space-y-2">
              {d.topExpenseCategories.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">No expenses recorded this month.</p>
              ) : (
                d.topExpenseCategories.slice(0, 3).map((c) => (
                  <div key={c.name} className="flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <PieIcon className="h-3.5 w-3.5" />
                      {c.name}
                    </span>
                    <span className="num font-semibold">{fmtMoney(c.amount, currency)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Approvals + recent activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Pending approvals"
          subtitle={d.pendingApprovals.length > 0 ? `${d.pendingApprovals.length} awaiting review · ${fmtMoney(d.pendingApprovalsTotal, currency)}` : undefined}
          empty={d.pendingApprovals.length === 0}
          emptyIcon={CheckCircle2}
          emptyTitle="All caught up"
          emptyDescription="Expense submissions you review will appear here."
        >
          <div className="divide-y divide-border/60">
            {d.pendingApprovals.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-5 py-3.5">
                <Avatarish name={e.submitter.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium leading-tight">{e.description}</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {e.submitter.name} · {fmtDate(e.date)}
                    {e.category ? ` · ${e.category.name}` : ""}
                  </p>
                </div>
                <span className="num text-[13.5px] font-semibold">{fmtMoney(e.amount)}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={reviewing === e.id}
                    onClick={() => review(e.id, "APPROVED")}
                    title="Approve"
                    className="press flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10 text-green-600 hover:bg-green-500/20 disabled:opacity-40 dark:text-green-400"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    disabled={reviewing === e.id}
                    onClick={() => review(e.id, "REJECTED")}
                    title="Reject"
                    className="press flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 text-red-600 hover:bg-red-500/20 disabled:opacity-40 dark:text-red-400"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Recent activity"
          subtitle="Latest ledger entries"
          empty={d.recentTransactions.length === 0}
          emptyIcon={Receipt}
          emptyTitle="No transactions yet"
          emptyDescription="Income and expense entries will appear here."
        >
          <div className="divide-y divide-border/60">
            {d.recentTransactions.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3.5">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full",
                    t.type === "INCOME" ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-red-500/10 text-red-600 dark:text-red-400"
                  )}
                >
                  {t.type === "INCOME" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium leading-tight">{t.description}</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {t.category?.name ?? "Uncategorized"}
                    {t.client ? ` · ${t.client.name}` : ""} · {fmtDate(t.date)}
                  </p>
                </div>
                <span className={cn("num text-[13.5px] font-semibold", t.type === "INCOME" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                  {t.type === "INCOME" ? "+" : "−"}{fmtMoney(t.amount)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function ChartTip({ active, payload, label, currency }: { active?: boolean; payload?: { name: string; value: number }[]; label?: string; currency?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass rounded-xl border border-black/8 px-3.5 py-2.5 text-xs shadow-lg dark:border-white/10">
      <p className="mb-1.5 font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="num flex items-center justify-between gap-4">
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

function InvoiceRow({ icon: Icon, tone, label, count, amount, currency }: { icon: typeof FileText; tone: "gray" | "blue" | "green"; label: string; count: number; amount?: number; currency?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/60 px-3.5 py-3">
      <Pill tone={tone}><Icon className="mr-1 h-3 w-3" />{count}</Pill>
      <span className="flex-1 text-[13.5px] font-medium">{label}</span>
      {amount !== undefined && <span className="num text-[13px] font-semibold text-muted-foreground">{fmtMoney(amount, currency)}</span>}
    </div>
  )
}

// ============================================================
// Personal (employee) view
// ============================================================

function PersonalBody({ d, currency }: { d: PersonalDashboard; currency: string }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Submissions" value={String(d.kpis.totalSubmitted)} icon={Receipt} tone="blue" />
        <KpiCard label="Pending" value={String(d.kpis.pending)} icon={Clock} tone="orange" />
        <KpiCard label="Approved" value={String(d.kpis.approved)} icon={CheckCircle2} tone="green" />
        <KpiCard label="Reimbursed" value={fmtMoney(d.kpis.approvedAmount, currency)} icon={Wallet} tone="green" />
        <KpiCard label="Approved · this month" value={fmtMoney(d.kpis.thisMonthApproved, currency)} icon={Banknote} tone="violet" />
      </div>

      <Card
        title="My recent expenses"
        subtitle="Your latest submissions and their review status"
        empty={d.recentExpenses.length === 0}
        emptyIcon={Receipt}
        emptyTitle="Nothing submitted yet"
        emptyDescription="Head to Expenses to submit your first claim."
      >
        <div className="divide-y divide-border/60">
          {d.recentExpenses.map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-5 py-3.5">
              <span className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full",
                e.status === "APPROVED" ? "bg-green-500/10 text-green-600 dark:text-green-400"
                  : e.status === "REJECTED" ? "bg-red-500/10 text-red-600 dark:text-red-400"
                  : "bg-orange-500/10 text-orange-600 dark:text-orange-400"
              )}>
                {e.status === "APPROVED" ? <Check className="h-4 w-4" /> : e.status === "REJECTED" ? <X className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium leading-tight">{e.description}</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {e.category?.name ?? "Uncategorized"} · {fmtDate(e.date)}
                  {e.reviewNote ? ` · “${e.reviewNote}”` : ""}
                </p>
              </div>
              <Pill tone={expenseTone(e.status)}>{e.status.charAt(0) + e.status.slice(1).toLowerCase()}</Pill>
              <span className="num text-[13.5px] font-semibold">{fmtMoney(e.amount)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ============================================================
// Shared bits
// ============================================================

export function Card({
  title,
  subtitle,
  children,
  empty,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  action,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  empty?: boolean
  emptyIcon: typeof FileText
  emptyTitle: string
  emptyDescription?: string
  action?: React.ReactNode
}) {
  return (
    <div className="card-shadow overflow-hidden rounded-2xl border bg-card">
      <div className="flex items-start justify-between px-5 pt-5 pb-4">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {empty ? <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} /> : children}
    </div>
  )
}

function Avatarish({ name }: { name: string }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
      {initials}
    </span>
  )
}

function DashboardSkeleton({ personal }: { personal: boolean }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: personal ? 5 : 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[118px] rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-[340px] rounded-2xl lg:col-span-2" />
        <Skeleton className="h-[340px] rounded-2xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[280px] rounded-2xl" />
        <Skeleton className="h-[280px] rounded-2xl" />
      </div>
    </div>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return "night"
  if (h < 12) return "morning"
  if (h < 17) return "afternoon"
  return "evening"
}

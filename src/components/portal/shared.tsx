"use client"

// ============================================================
// Shared primitives for the portal — currency, dates, pills,
// KPI cards, empty states and the little data-fetching hook
// every view uses. Apple visual language throughout.
// ============================================================

import { useCallback, createContext, useContext, useEffect, useState } from "react"
import { type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

// ---------------- Types shared across views ----------------

export type Role = "RED" | "ADMIN" | "MANAGER" | "EMPLOYEE"

export type Me = {
  user: { id: string; name: string; email: string; role: Role; status: string; title: string | null }
  capabilities: {
    assignableRoles: Role[]
    canManageFinance: boolean
    canDeleteRecords: boolean
    canApproveExpenses: boolean
    canManageUsers: boolean
    canViewAudit: boolean
    canEditCompanySettings: boolean
  }
  company: { companyName: string; currency: string; taxRate: number; email: string | null; phone: string | null; address: string | null } | null
  roleLabel: string
}

export type ViewId =
  | "dashboard"
  | "transactions"
  | "invoices"
  | "expenses"
  | "clients"
  | "reports"
  | "team"
  | "audit"
  | "settings"

// ---------------- Company context (currency etc.) ----------------

export const CompanyContext = createContext<{ currency: string; companyName: string }>({
  currency: "INR",
  companyName: "My Company",
})

export function useCompany() {
  return useContext(CompanyContext)
}

// ---------------- Formatting ----------------

export function fmtMoney(amount: number | null | undefined, currency = "INR"): string {
  const value = amount ?? 0
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: value >= 1000 ? 0 : 2,
    }).format(value)
  } catch {
    return `₹${value.toLocaleString()}`
  }
}

export function fmtNum(amount: number | null | undefined): string {
  return (amount ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—"
  return new Date(d).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function toInputDate(d: string | Date | null | undefined): string {
  if (!d) return ""
  const date = new Date(d)
  const off = date.getTimezoneOffset()
  return new Date(date.getTime() - off * 60000).toISOString().slice(0, 10)
}

// ---------------- Data fetching ----------------

export async function api<T = unknown>(url: string, method: "GET" | "POST" | "PATCH" | "DELETE" = "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(json?.error || "Something went wrong. Please try again.")
  return json
}

export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!url) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const json = await api<T>(url)
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => {
    void load()
  }, [load])

  return { data, loading, error, reload: load, setData }
}

// ---------------- Badges & pills ----------------

const ROLE_STYLES: Record<Role, string> = {
  RED: "bg-red-500/10 text-red-600 dark:bg-red-400/15 dark:text-red-400 ring-red-500/20",
  ADMIN: "bg-blue-500/10 text-blue-600 dark:bg-blue-400/15 dark:text-blue-400 ring-blue-500/20",
  MANAGER: "bg-violet-500/10 text-violet-600 dark:bg-violet-400/15 dark:text-violet-400 ring-violet-500/20",
  EMPLOYEE: "bg-zinc-500/10 text-zinc-600 dark:bg-zinc-400/15 dark:text-zinc-300 ring-zinc-500/20",
}

export function RoleBadge({ role, className }: { role: Role | string; className?: string }) {
  const r = (["RED", "ADMIN", "MANAGER", "EMPLOYEE"] as Role[]).includes(role as Role) ? (role as Role) : "EMPLOYEE"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        ROLE_STYLES[r],
        className
      )}
    >
      {r === "RED" && <span className="h-1.5 w-1.5 rounded-full bg-red-500 dark:bg-red-400" />}
      {r === "RED" ? "Red" : r.charAt(0) + r.slice(1).toLowerCase()}
    </span>
  )
}

type Tone = "gray" | "blue" | "green" | "red" | "orange" | "violet"

const TONES: Record<Tone, string> = {
  gray: "bg-zinc-500/10 text-zinc-600 dark:bg-zinc-400/10 dark:text-zinc-300 ring-zinc-500/20",
  blue: "bg-blue-500/10 text-blue-600 dark:bg-blue-400/15 dark:text-blue-400 ring-blue-500/20",
  green: "bg-green-500/10 text-green-700 dark:bg-green-400/15 dark:text-green-400 ring-green-500/25",
  red: "bg-red-500/10 text-red-600 dark:bg-red-400/15 dark:text-red-400 ring-red-500/20",
  orange: "bg-orange-500/10 text-orange-600 dark:bg-orange-400/15 dark:text-orange-400 ring-orange-500/20",
  violet: "bg-violet-500/10 text-violet-600 dark:bg-violet-400/15 dark:text-violet-400 ring-violet-500/20",
}

export function Pill({ tone = "gray", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset", TONES[tone], className)}>
      {children}
    </span>
  )
}

export function invoiceTone(status: string): Tone {
  switch (status) {
    case "PAID":
      return "green"
    case "SENT":
      return "blue"
    case "OVERDUE":
      return "red"
    default:
      return "gray"
  }
}

export function expenseTone(status: string): Tone {
  switch (status) {
    case "APPROVED":
      return "green"
    case "PENDING":
      return "orange"
    case "REJECTED":
      return "red"
    default:
      return "gray"
  }
}

// ---------------- Layout primitives ----------------

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-muted-foreground">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2.5">{children}</div>}
    </div>
  )
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "blue",
  loading,
}: {
  label: string
  value: string
  icon: LucideIcon
  hint?: string
  tone?: Tone
  loading?: boolean
}) {
  return (
    <div className="card-shadow press rounded-2xl border bg-card p-5 hover:card-shadow-hover">
      <div className="flex items-center justify-between">
        <span className="micro-label">{label}</span>
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-full ring-1 ring-inset", TONES[tone])}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-32" />
      ) : (
        <p className="num mt-2.5 text-[26px] font-semibold tracking-tight">{value}</p>
      )}
      {hint && !loading && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, children }: { icon: LucideIcon; title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="mt-4 text-[15px] font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  )
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2.5 p-5">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="m-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  )
}

// ---------------- Types for API payloads ----------------

export type CategoryT = { id: string; name: string; type: string; isActive: boolean }
export type UserLite = { id: string; name: string; role?: string; email?: string }

export type TransactionT = {
  id: string
  date: string
  type: "INCOME" | "EXPENSE"
  amount: number
  description: string
  reference: string | null
  paymentMethod: string
  categoryId: string | null
  category: CategoryT | null
  clientId: string | null
  client: { id: string; name: string } | null
  createdById: string | null
  createdBy: UserLite | null
}

export type InvoiceItemT = {
  id: string
  description: string
  quantity: number
  unitPrice: number
  amount: number
}

export type InvoiceT = {
  id: string
  number: string
  clientId: string
  client: { id: string; name: string; type: string }
  issueDate: string
  dueDate: string | null
  status: "DRAFT" | "SENT" | "PAID"
  subtotal: number
  taxRate: number
  taxAmount: number
  total: number
  notes: string | null
  createdById: string | null
  createdBy: UserLite | null
  items: InvoiceItemT[]
}

export type ExpenseT = {
  id: string
  submittedById: string
  submitter: UserLite
  date: string
  amount: number
  description: string
  receiptRef: string | null
  status: "PENDING" | "APPROVED" | "REJECTED"
  reviewNote: string | null
  reviewedAt: string | null
  reviewer: UserLite | null
  categoryId: string | null
  category: CategoryT | null
}

export type ClientT = {
  id: string
  name: string
  type: "CLIENT" | "VENDOR"
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  isActive: boolean
  _count: { invoices: number; transactions: number }
  outstanding: number
  openInvoices: number
  lifetimeBilled: number
}

export type TeamUser = {
  id: string
  name: string
  email: string
  role: Role
  status: string
  title: string | null
  createdAt: string
  updatedAt: string
  pendingExpenses: number
}

export type AuditEntry = {
  id: string
  actorId: string | null
  actor: { name: string; email: string; role: string } | null
  action: string
  targetType: string | null
  targetId: string | null
  targetLabel: string | null
  detail: string | null
  createdAt: string
}

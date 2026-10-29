"use client"

// ============================================================
// Expenses — everyone submits; Red/Admin/Manager review.
// Employees only ever see their own submissions.
// ============================================================

import { useMemo, useState } from "react"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wallet,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import {
  api,
  ErrorNote,
  expenseTone,
  fmtDate,
  fmtMoney,
  PageHeader,
  Pill,
  TableSkeleton,
  toInputDate,
  useApi,
  useCompany,
  type CategoryT,
  type ExpenseT,
  type Me,
  type UserLite,
} from "./shared"
import { EmptyState } from "./shared"
import { DebouncedSearchInput, HighlightMatch } from "./search-input"

type ListResponse = {
  expenses: ExpenseT[]
  categories: CategoryT[]
  submitters: (UserLite & { role: string })[]
  isApprover: boolean
  pendingCount: number
  pagination: { page: number; pages: number; total: number }
  totals: { pending: number; approved: number; rejected: number }
}

export function ExpensesView({ me, onMutation }: { me: Me; onMutation: () => void }) {
  const { currency } = useCompany()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("ALL")
  const [submitter, setSubmitter] = useState("ALL")
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<ExpenseT | "new" | null>(null)
  const [reviewing, setReviewing] = useState<ExpenseT | null>(null)
  const [deleting, setDeleting] = useState<ExpenseT | null>(null)

  const isApprover = me.capabilities.canApproveExpenses

  const url = useMemo(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set("q", search.trim())
    if (status !== "ALL") params.set("status", status)
    if (isApprover && submitter !== "ALL") params.set("submittedById", submitter)
    params.set("page", String(page))
    return `/api/expenses?${params.toString()}`
  }, [search, status, submitter, page, isApprover])

  const { data, loading, error, reload } = useApi<ListResponse>(url)

  async function handleDelete() {
    if (!deleting) return
    try {
      await api(`/api/expenses/${deleting.id}`, "DELETE")
      toast.success("Expense deleted")
      setDeleting(null)
      await reload()
      onMutation()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete.")
    }
  }

  const canDelete = (e: ExpenseT) =>
    (e.submittedById === me.user.id && e.status === "PENDING") || me.capabilities.canDeleteRecords

  const TABS = [
    { id: "ALL", label: "All" },
    { id: "PENDING", label: "Pending" },
    { id: "APPROVED", label: "Approved" },
    { id: "REJECTED", label: "Rejected" },
  ]

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle={isApprover ? "Submissions, reviews and reimbursements." : "Submit claims and follow their review."}
      >
        <Button onClick={() => setEditing("new")} className="press h-10 rounded-full px-5 gap-1.5 shadow-md shadow-primary/25">
          <Plus className="h-4 w-4" /> Submit expense
        </Button>
      </PageHeader>

      {/* Totals strip */}
      {data && (
        <div className="mb-5 grid grid-cols-3 gap-4">
          <div className="card-shadow rounded-2xl border bg-card px-5 py-3.5">
            <p className="micro-label">{isApprover ? "Awaiting review" : "My pending"}</p>
            <p className="num mt-1 text-[19px] font-semibold text-orange-600 dark:text-orange-400">{fmtMoney(data.totals.pending, currency)}</p>
          </div>
          <div className="card-shadow rounded-2xl border bg-card px-5 py-3.5">
            <p className="micro-label">{isApprover ? "Approved" : "My approved"}</p>
            <p className="num mt-1 text-[19px] font-semibold text-green-600 dark:text-green-400">{fmtMoney(data.totals.approved, currency)}</p>
          </div>
          <div className="card-shadow rounded-2xl border bg-card px-5 py-3.5">
            <p className="micro-label">{isApprover ? "Rejected" : "My rejected"}</p>
            <p className="num mt-1 text-[19px] font-semibold text-red-600 dark:text-red-400">{fmtMoney(data.totals.rejected, currency)}</p>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="card-shadow mb-5 flex flex-wrap items-center gap-2.5 rounded-2xl border bg-card p-3">
        <div className="flex rounded-lg bg-muted p-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setStatus(t.id); setPage(1) }}
              className={cn(
                "press rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-all",
                status === t.id ? "bg-white text-foreground shadow-sm dark:bg-zinc-800" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              {t.id === "PENDING" && data && data.pendingCount > 0 && (
                <span className="ml-1.5 rounded-full bg-orange-500 px-1.5 py-px text-[10px] font-bold text-white">{data.pendingCount}</span>
              )}
            </button>
          ))}
        </div>
        {isApprover && data && data.submitters.length > 0 && (
          <Select value={submitter} onValueChange={(v) => { setSubmitter(v); setPage(1) }}>
            <SelectTrigger className="h-9 w-[170px] rounded-lg bg-muted/50 border-transparent"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Everyone</SelectItem>
              {data.submitters.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <DebouncedSearchInput
          value={search}
          onChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Search description, submitter, category, amount… (/)"
          loading={loading}
          totalResults={data?.pagination.total}
          className="min-w-[220px] flex-1"
        />
      </div>

      {/* List */}
      <div className="card-shadow overflow-hidden rounded-2xl border bg-card">
        {error && <ErrorNote message={error} />}
        {loading && !data ? (
          <TableSkeleton rows={6} />
        ) : !data ? null : data.expenses.length === 0 ? (
          <EmptyState icon={Wallet} title="Nothing here yet" description={status !== "ALL" ? `No ${status.toLowerCase()} expenses.` : "Submit an expense to get started."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="micro-label px-5 py-3 font-semibold">{isApprover ? "Submitted by" : "Date"}</th>
                  <th className="micro-label px-3 py-3 font-semibold">Description</th>
                  <th className="micro-label px-3 py-3 font-semibold">Category</th>
                  {isApprover && <th className="micro-label px-3 py-3 font-semibold">Date</th>}
                  <th className="micro-label px-3 py-3 font-semibold">Status</th>
                  <th className="micro-label px-3 py-3 text-right font-semibold">Amount</th>
                  <th className="micro-label px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {data.expenses.map((e) => (
                  <tr key={e.id} className="transition-colors hover:bg-accent/50">
                    <td className="whitespace-nowrap px-5 py-3.5">
                      {isApprover ? (
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[10.5px] font-semibold text-primary">
                            {e.submitter.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                          </span>
                          <span className="font-medium">
                            <HighlightMatch text={e.submitter.name} query={search} />
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">{fmtDate(e.date)}</span>
                      )}
                    </td>
                    <td className="max-w-[260px] px-3 py-3.5">
                      <p className="truncate font-medium">
                        <HighlightMatch text={e.description} query={search} />
                      </p>
                      {e.reviewNote && <p className="truncate text-[12px] text-muted-foreground">“{e.reviewNote}” · {e.reviewer?.name ?? ""}</p>}
                      {!e.reviewNote && e.receiptRef && <p className="truncate text-[12px] text-muted-foreground">Receipt {e.receiptRef}</p>}
                    </td>
                    <td className="px-3 py-3.5"><Pill tone="gray">{e.category?.name ?? "—"}</Pill></td>
                    {isApprover && <td className="whitespace-nowrap px-3 py-3.5 text-muted-foreground">{fmtDate(e.date)}</td>}
                    <td className="px-3 py-3.5"><Pill tone={expenseTone(e.status)}>{e.status.charAt(0) + e.status.slice(1).toLowerCase()}</Pill></td>
                    <td className="num whitespace-nowrap px-3 py-3.5 text-right font-semibold">{fmtMoney(e.amount, currency)}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right">
                      {isApprover && e.status === "PENDING" && e.submittedById !== me.user.id ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => setReviewing(e)} title="Review" className="press rounded-lg bg-primary/10 px-3 py-1.5 text-[12px] font-semibold text-primary hover:bg-primary/20">
                            Review
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end">
                          {e.submittedById === me.user.id && e.status === "PENDING" && (
                            <button onClick={() => setEditing(e)} title="Edit" className="press ml-1 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {canDelete(e) && (
                            <button onClick={() => setDeleting(e)} title="Delete" className="press ml-1 rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-600">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.pagination.pages > 1 && (
          <div className="flex items-center justify-between border-t px-5 py-3">
            <p className="text-[12px] text-muted-foreground">Page {data.pagination.page} of {data.pagination.pages} · {data.pagination.total} expenses</p>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="press h-8 rounded-lg"><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" disabled={page >= data.pagination.pages} onClick={() => setPage((p) => p + 1)} className="press h-8 rounded-lg"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </div>

      {/* Submit / edit dialog */}
      {editing !== null && data && (
        <ExpenseDialog
          expense={editing === "new" ? null : editing}
          categories={data.categories}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await reload()
            onMutation()
          }}
        />
      )}

      {/* Review dialog */}
      {reviewing && (
        <ReviewDialog
          expense={reviewing}
          currency={currency}
          onClose={() => setReviewing(null)}
          onSaved={async () => {
            setReviewing(null)
            await reload()
            onMutation()
          }}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.description}” · {fmtMoney(deleting?.amount ?? 0, currency)}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="press rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="press rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============================================================
// Submit / edit dialog
// ============================================================

function ExpenseDialog({
  expense,
  categories,
  onClose,
  onSaved,
}: {
  expense: ExpenseT | null
  categories: CategoryT[]
  onClose: () => void
  onSaved: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [date, setDate] = useState(toInputDate(expense?.date ?? new Date()))
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "")
  const [description, setDescription] = useState(expense?.description ?? "")
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? "none")
  const [receiptRef, setReceiptRef] = useState(expense?.receiptRef ?? "")

  async function save() {
    setBusy(true)
    try {
      const body = { date, amount: Number(amount), description, categoryId: categoryId === "none" ? null : categoryId, receiptRef: receiptRef || null }
      if (expense) {
        await api(`/api/expenses/${expense.id}`, "PATCH", body)
        toast.success("Expense updated")
      } else {
        await api("/api/expenses", "POST", body)
        toast.success("Expense submitted for review")
      }
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[440px] rounded-[20px] p-6">
        <DialogHeader>
          <DialogTitle className="tracking-tight">{expense ? "Edit expense" : "Submit an expense"}</DialogTitle>
          <DialogDescription>{expense ? "Changes are allowed while the claim is pending." : "Your manager will review this claim."}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Amount</Label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="h-10 rounded-lg num" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px]">Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Client visit — fuel" className="h-10 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorized</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Receipt ref. <span className="text-muted-foreground">(optional)</span></Label>
              <Input value={receiptRef} onChange={(e) => setReceiptRef(e.target.value)} placeholder="e.g. RCPT-1042" className="h-10 rounded-lg" />
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="outline" onClick={onClose} className="press h-10 rounded-full px-5">Cancel</Button>
          <Button onClick={save} disabled={busy} className="press h-10 rounded-full px-6">{expense ? "Save changes" : "Submit"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Review dialog — approve / reject with a note
// ============================================================

function ReviewDialog({
  expense,
  currency,
  onClose,
  onSaved,
}: {
  expense: ExpenseT
  currency: string
  onClose: () => void
  onSaved: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState("")
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED" | null>(null)

  async function decide(status: "APPROVED" | "REJECTED") {
    setBusy(true)
    setDecision(status)
    try {
      await api(`/api/expenses/${expense.id}`, "PATCH", { action: "review", status, note })
      toast.success(status === "APPROVED" ? "Expense approved" : "Expense rejected")
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save review.")
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[420px] rounded-[20px] p-6">
        <DialogHeader>
          <DialogTitle className="tracking-tight">Review expense</DialogTitle>
          <DialogDescription>
            {expense.description} · {fmtMoney(expense.amount, currency)} · from {expense.submitter.name} on {fmtDate(expense.date)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div className="rounded-xl bg-muted/60 p-4 text-[13px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Category</span>
              <span className="font-medium">{expense.category?.name ?? "Uncategorized"}</span>
            </div>
            {expense.receiptRef && (
              <div className="mt-2 flex justify-between">
                <span className="text-muted-foreground">Receipt</span>
                <span className="font-medium">{expense.receiptRef}</span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-[13px]">Note to submitter <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="e.g. Approved for this month's budget." className="rounded-lg" />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => decide("REJECTED")}
            className={cn("press h-10 rounded-full gap-1.5", decision === "REJECTED" && "ring-2 ring-red-500/40")}
          >
            {busy && decision === "REJECTED" ? <Clock className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Reject
          </Button>
          <Button
            disabled={busy}
            onClick={() => decide("APPROVED")}
            className={cn("press h-10 rounded-full gap-1.5 bg-green-600 text-white hover:bg-green-600/90", decision === "APPROVED" && "ring-2 ring-green-500/40")}
          >
            {busy && decision === "APPROVED" ? <Clock className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

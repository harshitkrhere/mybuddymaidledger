"use client"

// ============================================================
// Transactions — the income/expense ledger (finance roles).
// Search, filters, pagination, create/edit/delete gated by role.
// ============================================================

import { useMemo, useState } from "react"
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import {
  api,
  ErrorNote,
  fmtDate,
  fmtMoney,
  PageHeader,
  Pill,
  TableSkeleton,
  toInputDate,
  useApi,
  useCompany,
  type CategoryT,
  type Me,
  type TransactionT,
} from "./shared"
import { EmptyState } from "./shared"
import { DebouncedSearchInput, HighlightMatch } from "./search-input"

type ListResponse = {
  transactions: TransactionT[]
  categories: CategoryT[]
  clients: { id: string; name: string; type: string }[]
  pagination: { page: number; pages: number; total: number }
  totals: { income: number; expense: number; net: number }
}

export function TransactionsView({ me, onMutation }: { me: Me; onMutation: () => void }) {
  const { currency } = useCompany()
  const [search, setSearch] = useState("")
  const [type, setType] = useState("ALL")
  const [category, setCategory] = useState("ALL")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<TransactionT | "new" | null>(null)
  const [deleting, setDeleting] = useState<TransactionT | null>(null)

  const url = useMemo(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set("q", search.trim())
    if (type !== "ALL") params.set("type", type)
    if (category !== "ALL") params.set("categoryId", category)
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    params.set("page", String(page))
    return `/api/transactions?${params.toString()}`
  }, [search, type, category, from, to, page])

  const { data, loading, error, reload } = useApi<ListResponse>(url)

  function resetPage() {
    setPage(1)
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await api(`/api/transactions/${deleting.id}`, "DELETE")
      toast.success("Transaction deleted")
      setDeleting(null)
      await reload()
      onMutation()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete.")
    }
  }

  const canEdit = me.capabilities.canManageFinance
  const canDelete = me.capabilities.canDeleteRecords

  return (
    <div>
      <PageHeader title="Transactions" subtitle="Every rupee in, every rupee out.">
        {canEdit && (
          <Button onClick={() => setEditing("new")} className="press rounded-full h-10 px-5 gap-1.5 shadow-md shadow-primary/25">
            <Plus className="h-4 w-4" /> New transaction
          </Button>
        )}
      </PageHeader>

      {/* Filter bar */}
      <div className="card-shadow mb-5 flex flex-wrap items-center gap-2.5 rounded-2xl border bg-card p-3">
        <DebouncedSearchInput
          value={search}
          onChange={(v) => {
            setSearch(v)
            resetPage()
          }}
          placeholder="Search by description, reference, party, amount… (/)"
          loading={loading}
          totalResults={data?.pagination.total}
          className="min-w-[240px] flex-1"
        />
        <Select value={type} onValueChange={(v) => { setType(v); resetPage() }}>
          <SelectTrigger className="h-9 w-[130px] rounded-lg bg-muted/50 border-transparent"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            <SelectItem value="INCOME">Income</SelectItem>
            <SelectItem value="EXPENSE">Expense</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={(v) => { setCategory(v); resetPage() }}>
          <SelectTrigger className="h-9 w-[160px] rounded-lg bg-muted/50 border-transparent"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            {(data?.categories ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); resetPage() }} className="h-9 w-[136px] rounded-lg bg-muted/50 border-transparent" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); resetPage() }} className="h-9 w-[136px] rounded-lg bg-muted/50 border-transparent" />
        </div>
      </div>

      {/* Totals strip */}
      {data && (
        <div className="mb-5 grid grid-cols-3 gap-4">
          <div className="card-shadow rounded-2xl border bg-card px-5 py-3.5">
            <p className="micro-label">Income · filtered</p>
            <p className="num mt-1 text-[19px] font-semibold text-green-600 dark:text-green-400">{fmtMoney(data.totals.income, currency)}</p>
          </div>
          <div className="card-shadow rounded-2xl border bg-card px-5 py-3.5">
            <p className="micro-label">Expense · filtered</p>
            <p className="num mt-1 text-[19px] font-semibold text-red-600 dark:text-red-400">{fmtMoney(data.totals.expense, currency)}</p>
          </div>
          <div className="card-shadow rounded-2xl border bg-card px-5 py-3.5">
            <p className="micro-label">Net</p>
            <p className="num mt-1 text-[19px] font-semibold">{fmtMoney(data.totals.net, currency)}</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card-shadow overflow-hidden rounded-2xl border bg-card">
        {error && <ErrorNote message={error} />}
        {loading && !data ? (
          <TableSkeleton rows={8} />
        ) : !data ? null : data.transactions.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="No transactions found"
            description={search || type !== "ALL" || category !== "ALL" ? "Try loosening the filters." : "Record your first income or expense entry."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="micro-label px-5 py-3 font-semibold">Date</th>
                  <th className="micro-label px-3 py-3 font-semibold">Description</th>
                  <th className="micro-label px-3 py-3 font-semibold">Category</th>
                  <th className="micro-label hidden px-3 py-3 font-semibold lg:table-cell">Party</th>
                  <th className="micro-label hidden px-3 py-3 font-semibold md:table-cell">Method</th>
                  <th className="micro-label px-3 py-3 text-right font-semibold">Amount</th>
                  <th className="micro-label hidden px-3 py-3 font-semibold xl:table-cell">By</th>
                  {(canEdit || canDelete) && <th className="micro-label px-5 py-3 text-right font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {data.transactions.map((t) => (
                  <tr key={t.id} className="transition-colors hover:bg-accent/50">
                    <td className="whitespace-nowrap px-5 py-3.5 text-muted-foreground">{fmtDate(t.date)}</td>
                    <td className="max-w-[260px] px-3 py-3.5">
                      <p className="truncate font-medium">
                        <HighlightMatch text={t.description} query={search} />
                      </p>
                      {t.reference && (
                        <p className="truncate text-[12px] text-muted-foreground">
                          Ref <HighlightMatch text={t.reference} query={search} />
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3.5">
                      <Pill tone={t.type === "INCOME" ? "green" : "red"}>{t.category?.name ?? "—"}</Pill>
                    </td>
                    <td className="hidden max-w-[160px] truncate px-3 py-3.5 text-muted-foreground lg:table-cell">
                      <HighlightMatch text={t.client?.name ?? "—"} query={search} />
                    </td>
                    <td className="hidden px-3 py-3.5 text-muted-foreground md:table-cell">{t.paymentMethod}</td>
                    <td className={cn("num whitespace-nowrap px-3 py-3.5 text-right font-semibold", t.type === "INCOME" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                      {t.type === "INCOME" ? "+" : "−"}{fmtMoney(t.amount, currency)}
                    </td>
                    <td className="hidden max-w-[140px] truncate px-3 py-3.5 text-muted-foreground xl:table-cell">{t.createdBy?.name ?? "—"}</td>
                    {(canEdit || canDelete) && (
                      <td className="whitespace-nowrap px-5 py-3.5 text-right">
                        {canEdit && (
                          <button onClick={() => setEditing(t)} title="Edit" className="press ml-1 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => setDeleting(t)} title="Delete" className="press ml-1 rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.pagination.pages > 1 && (
          <div className="flex items-center justify-between border-t px-5 py-3">
            <p className="text-[12px] text-muted-foreground">
              Page {data.pagination.page} of {data.pagination.pages} · {data.pagination.total} entries
            </p>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="press h-8 rounded-lg">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= data.pagination.pages} onClick={() => setPage((p) => p + 1)} className="press h-8 rounded-lg">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create / edit dialog */}
      {editing !== null && data && (
        <TransactionDialog
          transaction={editing === "new" ? null : editing}
          categories={data.categories}
          clients={data.clients}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await reload()
            onMutation()
          }}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.description}” · {fmtMoney(deleting?.amount ?? 0, currency)} on {fmtDate(deleting?.date)}. This permanently removes it from the ledger.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="press rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="press rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============================================================
// Create / edit dialog
// ============================================================

function TransactionDialog({
  transaction,
  categories,
  clients,
  onClose,
  onSaved,
}: {
  transaction: TransactionT | null
  categories: CategoryT[]
  clients: { id: string; name: string; type: string }[]
  onClose: () => void
  onSaved: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [type, setType] = useState<"INCOME" | "EXPENSE">(transaction?.type ?? "INCOME")
  const [date, setDate] = useState(toInputDate(transaction?.date ?? new Date()))
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : "")
  const [description, setDescription] = useState(transaction?.description ?? "")
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? "none")
  const [clientId, setClientId] = useState(transaction?.clientId ?? "none")
  const [reference, setReference] = useState(transaction?.reference ?? "")
  const [method, setMethod] = useState(transaction?.paymentMethod ?? "BANK")

  const relevantCategories = categories.filter((c) => c.type === type)

  async function save() {
    setBusy(true)
    try {
      const body = {
        date,
        type,
        amount: Number(amount),
        description,
        categoryId: categoryId === "none" ? null : categoryId,
        clientId: clientId === "none" ? null : clientId,
        reference: reference || null,
        paymentMethod: method,
      }
      if (transaction) {
        await api(`/api/transactions/${transaction.id}`, "PATCH", body)
        toast.success("Transaction updated")
      } else {
        await api("/api/transactions", "POST", body)
        toast.success("Transaction recorded")
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
      <DialogContent className="max-w-[520px] rounded-[20px] p-6">
        <DialogHeader>
          <DialogTitle className="tracking-tight">{transaction ? "Edit transaction" : "New transaction"}</DialogTitle>
          <DialogDescription>{transaction ? "Update the ledger entry." : "Record income or an expense."}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Type segmented control */}
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            {(["INCOME", "EXPENSE"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setType(t)
                  setCategoryId("none")
                }}
                className={cn(
                  "press flex h-9 items-center justify-center gap-1.5 rounded-lg text-[13.5px] font-semibold transition-all",
                  type === t
                    ? t === "INCOME"
                      ? "bg-white text-green-600 shadow-sm dark:bg-zinc-800 dark:text-green-400"
                      : "bg-white text-red-600 shadow-sm dark:bg-zinc-800 dark:text-red-400"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "INCOME" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                {t === "INCOME" ? "Income" : "Expense"}
              </button>
            ))}
          </div>

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
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={type === "INCOME" ? "e.g. Gold plan sale — Sharma family" : "e.g. Helper transport costs"} className="h-10 rounded-lg" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="h-10 rounded-lg"><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {relevantCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">{type === "INCOME" ? "Client" : "Vendor / client"}</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="h-10 rounded-lg"><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Payment method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["BANK", "UPI", "CARD", "CASH"].map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Reference <span className="text-muted-foreground">(optional)</span></Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Invoice no., UTR…" className="h-10 rounded-lg" />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <Button variant="outline" onClick={onClose} className="press h-10 rounded-full px-5">Cancel</Button>
          <Button onClick={save} disabled={busy} className="press h-10 rounded-full px-6">
            {transaction ? "Save changes" : "Add transaction"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

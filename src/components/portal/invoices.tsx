"use client"

// ============================================================
// Invoices — create with line items + tax, send, mark paid.
// Statuses: DRAFT → SENT → PAID, OVERDUE derived from due date.
// ============================================================

import { useMemo, useState } from "react"
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import {
  api,
  ErrorNote,
  fmtDate,
  fmtMoney,
  invoiceTone,
  PageHeader,
  Pill,
  TableSkeleton,
  toInputDate,
  useApi,
  useCompany,
  type InvoiceT,
  type Me,
} from "./shared"
import { EmptyState } from "./shared"

type ListResponse = {
  invoices: InvoiceT[]
  clients: { id: string; name: string }[]
  pagination: { page: number; pages: number; total: number }
  totals: { draft: number; sent: number; paid: number; drafts: number; sents: number; paids: number }
}

type LineItem = { description: string; quantity: string; unitPrice: string }

function derivedStatus(inv: InvoiceT): "DRAFT" | "SENT" | "PAID" | "OVERDUE" {
  if (inv.status === "SENT" && inv.dueDate && new Date(inv.dueDate) < new Date()) return "OVERDUE"
  return inv.status
}

export function InvoicesView({ me, onMutation }: { me: Me; onMutation: () => void }) {
  const { currency } = useCompany()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("ALL")
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<InvoiceT | "new" | null>(null)
  const [viewing, setViewing] = useState<InvoiceT | null>(null)
  const [deleting, setDeleting] = useState<InvoiceT | null>(null)

  const url = useMemo(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set("q", search.trim())
    if (status !== "ALL") params.set("status", status)
    params.set("page", String(page))
    return `/api/invoices?${params.toString()}`
  }, [search, status, page])

  const { data, loading, error, reload } = useApi<ListResponse>(url)

  async function setStatusOf(inv: InvoiceT, next: "DRAFT" | "SENT" | "PAID") {
    try {
      await api(`/api/invoices/${inv.id}`, "PATCH", { action: "setStatus", status: next })
      toast.success(next === "SENT" ? `Invoice ${inv.number} marked sent` : next === "PAID" ? `Invoice ${inv.number} marked paid` : `Invoice ${inv.number} moved back to draft`)
      await reload()
      onMutation()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update.")
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await api(`/api/invoices/${deleting.id}`, "DELETE")
      toast.success("Invoice deleted")
      setDeleting(null)
      await reload()
      onMutation()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete.")
    }
  }

  const canEdit = me.capabilities.canManageFinance
  const canDelete = me.capabilities.canDeleteRecords

  const TABS = [
    { id: "ALL", label: "All" },
    { id: "DRAFT", label: "Drafts" },
    { id: "SENT", label: "Sent" },
    { id: "PAID", label: "Paid" },
  ]

  return (
    <div>
      <PageHeader title="Invoices" subtitle="Bill clients, track what's outstanding.">
        {canEdit && (
          <Button onClick={() => setEditing("new")} className="press h-10 rounded-full px-5 gap-1.5 shadow-md shadow-primary/25">
            <Plus className="h-4 w-4" /> New invoice
          </Button>
        )}
      </PageHeader>

      {/* Totals strip */}
      {data && (
        <div className="mb-5 grid grid-cols-3 gap-4">
          <div className="card-shadow rounded-2xl border bg-card px-5 py-3.5">
            <p className="micro-label">Drafts</p>
            <p className="num mt-1 text-[19px] font-semibold">{fmtMoney(data.totals.draft, currency)}<span className="ml-1.5 text-[12px] font-normal text-muted-foreground">· {data.totals.drafts}</span></p>
          </div>
          <div className="card-shadow rounded-2xl border bg-card px-5 py-3.5">
            <p className="micro-label">Outstanding</p>
            <p className="num mt-1 text-[19px] font-semibold text-blue-600 dark:text-blue-400">{fmtMoney(data.totals.sent, currency)}<span className="ml-1.5 text-[12px] font-normal text-muted-foreground">· {data.totals.sents}</span></p>
          </div>
          <div className="card-shadow rounded-2xl border bg-card px-5 py-3.5">
            <p className="micro-label">Collected</p>
            <p className="num mt-1 text-[19px] font-semibold text-green-600 dark:text-green-400">{fmtMoney(data.totals.paid, currency)}<span className="ml-1.5 text-[12px] font-normal text-muted-foreground">· {data.totals.paids}</span></p>
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
            </button>
          ))}
        </div>
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by number or client…"
            className="h-9 rounded-lg pl-9 bg-muted/50 border-transparent focus:bg-background"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card-shadow overflow-hidden rounded-2xl border bg-card">
        {error && <ErrorNote message={error} />}
        {loading && !data ? (
          <TableSkeleton rows={6} />
        ) : !data ? null : data.invoices.length === 0 ? (
          <EmptyState icon={FileText} title="No invoices here" description={status !== "ALL" ? `Nothing with status “${status}”.` : "Create your first invoice to bill a client."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="micro-label px-5 py-3 font-semibold">Invoice</th>
                  <th className="micro-label px-3 py-3 font-semibold">Client</th>
                  <th className="micro-label px-3 py-3 font-semibold">Issued</th>
                  <th className="micro-label px-3 py-3 font-semibold">Due</th>
                  <th className="micro-label px-3 py-3 font-semibold">Status</th>
                  <th className="micro-label px-3 py-3 text-right font-semibold">Total</th>
                  {canEdit && <th className="micro-label px-5 py-3 text-right font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {data.invoices.map((inv) => {
                  const ds = derivedStatus(inv)
                  return (
                    <tr key={inv.id} className="cursor-pointer transition-colors hover:bg-accent/50" onClick={() => setViewing(inv)}>
                      <td className="whitespace-nowrap px-5 py-3.5 font-semibold">{inv.number}</td>
                      <td className="max-w-[180px] truncate px-3 py-3.5">{inv.client.name}</td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-muted-foreground">{fmtDate(inv.issueDate)}</td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-muted-foreground">{fmtDate(inv.dueDate)}</td>
                      <td className="px-3 py-3.5"><Pill tone={invoiceTone(ds)}>{ds.charAt(0) + ds.slice(1).toLowerCase()}</Pill></td>
                      <td className="num whitespace-nowrap px-3 py-3.5 text-right font-semibold">{fmtMoney(inv.total, currency)}</td>
                      {canEdit && (
                        <td className="whitespace-nowrap px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                          {inv.status === "DRAFT" && (
                            <button onClick={() => setStatusOf(inv, "SENT")} title="Mark sent" className="press ml-1 rounded-lg p-1.5 text-muted-foreground hover:bg-blue-500/10 hover:text-blue-600">
                              <Send className="h-4 w-4" />
                            </button>
                          )}
                          {inv.status === "SENT" && (
                            <button onClick={() => setStatusOf(inv, "PAID")} title="Mark paid" className="press ml-1 rounded-lg p-1.5 text-muted-foreground hover:bg-green-500/10 hover:text-green-600">
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                          )}
                          {inv.status === "PAID" && (
                            <button onClick={() => setStatusOf(inv, "DRAFT")} title="Move back to draft" className="press ml-1 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          <button onClick={() => setEditing(inv)} title="Edit" className="press ml-1 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
                            <Pencil className="h-4 w-4" />
                          </button>
                          {canDelete && (
                            <button onClick={() => setDeleting(inv)} title="Delete" className="press ml-1 rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-600">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {data && data.pagination.pages > 1 && (
          <div className="flex items-center justify-between border-t px-5 py-3">
            <p className="text-[12px] text-muted-foreground">Page {data.pagination.page} of {data.pagination.pages} · {data.pagination.total} invoices</p>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="press h-8 rounded-lg"><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" disabled={page >= data.pagination.pages} onClick={() => setPage((p) => p + 1)} className="press h-8 rounded-lg"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </div>

      {/* Create / edit */}
      {editing !== null && data && (
        <InvoiceDialog
          invoice={editing === "new" ? null : editing}
          clients={data.clients}
          defaultTax={me.company?.taxRate ?? 18}
          currency={currency}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await reload()
            onMutation()
          }}
        />
      )}

      {/* Detail view */}
      {viewing && (
        <InvoiceDetail
          invoice={viewing}
          currency={currency}
          onClose={() => setViewing(null)}
          onEdit={() => { setEditing(viewing); setViewing(null) }}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.number} · {fmtMoney(deleting?.total ?? 0, currency)} for {deleting?.client.name}. This cannot be undone.
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
// Create / edit dialog with line items
// ============================================================

function InvoiceDialog({
  invoice,
  clients,
  defaultTax,
  currency,
  onClose,
  onSaved,
}: {
  invoice: InvoiceT | null
  clients: { id: string; name: string }[]
  defaultTax: number
  currency: string
  onClose: () => void
  onSaved: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [clientId, setClientId] = useState(invoice?.clientId ?? "")
  const [issueDate, setIssueDate] = useState(toInputDate(invoice?.issueDate ?? new Date()))
  const [dueDate, setDueDate] = useState(toInputDate(invoice?.dueDate ?? new Date(Date.now() + 15 * 86400000)))
  const [taxRate, setTaxRate] = useState(String(invoice?.taxRate ?? defaultTax))
  const [notes, setNotes] = useState(invoice?.notes ?? "")
  const [items, setItems] = useState<LineItem[]>(
    invoice?.items?.length
      ? invoice.items.map((i) => ({ description: i.description, quantity: String(i.quantity), unitPrice: String(i.unitPrice) }))
      : [{ description: "", quantity: "1", unitPrice: "" }]
  )

  const computed = useMemo(() => {
    const lines = items.map((i) => ({
      quantity: Number(i.quantity) || 0,
      unitPrice: Number(i.unitPrice) || 0,
    }))
    const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
    const tax = subtotal * ((Number(taxRate) || 0) / 100)
    return { subtotal, tax, total: subtotal + tax }
  }, [items, taxRate])

  function updateItem(idx: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  async function save() {
    if (!clientId) {
      toast.error("Please choose a client.")
      return
    }
    setBusy(true)
    try {
      const body = {
        clientId,
        issueDate,
        dueDate: dueDate || null,
        taxRate: Number(taxRate) || 0,
        notes: notes || null,
        items: items
          .filter((i) => i.description.trim())
          .map((i) => ({ description: i.description, quantity: Number(i.quantity) || 0, unitPrice: Number(i.unitPrice) || 0 })),
      }
      if (invoice) {
        await api(`/api/invoices/${invoice.id}`, "PATCH", body)
        toast.success("Invoice updated")
      } else {
        await api("/api/invoices", "POST", body)
        toast.success("Invoice created")
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
      <DialogContent className="max-w-[580px] rounded-[20px] p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="tracking-tight">{invoice ? `Edit ${invoice.number}` : "New invoice"}</DialogTitle>
          <DialogDescription>{invoice ? "Update the details below." : "Add line items; totals compute automatically."}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="h-10 rounded-lg"><SelectValue placeholder="Choose client…" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Tax rate (%)</Label>
              <Input type="number" min="0" max="100" step="0.5" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="h-10 rounded-lg num" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Issue date</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="h-10 rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-10 rounded-lg" />
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-[13px]">Line items</Label>
              <Button variant="outline" size="sm" onClick={() => setItems((p) => [...p, { description: "", quantity: "1", unitPrice: "" }])} className="press h-7 rounded-full px-3 text-[12px]">
                <Plus className="h-3.5 w-3.5" /> Add item
              </Button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_84px_110px_36px] items-center gap-2">
                <Input
                  value={item.description}
                  onChange={(e) => updateItem(idx, { description: e.target.value })}
                  placeholder="e.g. Gold plan · 12 months"
                  className="h-9 rounded-lg"
                />
                <Input
                  type="number" min="0" step="0.5" value={item.quantity}
                  onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                  placeholder="Qty" className="h-9 rounded-lg num"
                  aria-label="Quantity"
                />
                <Input
                  type="number" min="0" step="0.01" value={item.unitPrice}
                  onChange={(e) => updateItem(idx, { unitPrice: e.target.value })}
                  placeholder="Unit price" className="h-9 rounded-lg num"
                  aria-label="Unit price"
                />
                <button
                  type="button"
                  onClick={() => setItems((p) => (p.length > 1 ? p.filter((_, i) => i !== idx) : p))}
                  className="press flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-600"
                  title="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label className="text-[13px]">Notes <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Payment terms, thank-you note…" className="rounded-lg" />
          </div>

          {/* Totals */}
          <div className="space-y-1.5 rounded-xl bg-muted/60 p-4">
            <div className="flex justify-between text-[13px] text-muted-foreground">
              <span>Subtotal</span><span className="num font-medium text-foreground">{fmtMoney(computed.subtotal, currency)}</span>
            </div>
            <div className="flex justify-between text-[13px] text-muted-foreground">
              <span>Tax ({taxRate || 0}%)</span><span className="num font-medium text-foreground">{fmtMoney(computed.tax, currency)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-[15px] font-semibold">
              <span>Total</span><span className="num">{fmtMoney(computed.total, currency)}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="outline" onClick={onClose} className="press h-10 rounded-full px-5">Cancel</Button>
          <Button onClick={save} disabled={busy} className="press h-10 rounded-full px-6">{invoice ? "Save changes" : "Create invoice"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Detail dialog
// ============================================================

function InvoiceDetail({ invoice, currency, onClose, onEdit }: { invoice: InvoiceT; currency: string; onClose: () => void; onEdit: () => void }) {
  const ds = derivedStatus(invoice)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[540px] rounded-[20px] p-6">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <DialogTitle className="tracking-tight">{invoice.number}</DialogTitle>
            <Pill tone={invoiceTone(ds)}>{ds.charAt(0) + ds.slice(1).toLowerCase()}</Pill>
          </div>
          <DialogDescription>
            {invoice.client.name} · issued {fmtDate(invoice.issueDate)}{invoice.dueDate ? ` · due ${fmtDate(invoice.dueDate)}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 py-2">
          <p className="micro-label mb-2">Line items</p>
          {invoice.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between border-b border-border/40 py-2.5 text-[13.5px] last:border-0">
              <div>
                <p className="font-medium">{item.description}</p>
                <p className="text-[12px] text-muted-foreground">{item.quantity} × {fmtMoney(item.unitPrice, currency)}</p>
              </div>
              <span className="num font-semibold">{fmtMoney(item.amount, currency)}</span>
            </div>
          ))}
        </div>

        <div className="space-y-1.5 rounded-xl bg-muted/60 p-4">
          <div className="flex justify-between text-[13px] text-muted-foreground">
            <span>Subtotal</span><span className="num font-medium text-foreground">{fmtMoney(invoice.subtotal, currency)}</span>
          </div>
          <div className="flex justify-between text-[13px] text-muted-foreground">
            <span>Tax ({invoice.taxRate}%)</span><span className="num font-medium text-foreground">{fmtMoney(invoice.taxAmount, currency)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-[15px] font-semibold">
            <span>Total</span><span className="num">{fmtMoney(invoice.total, currency)}</span>
          </div>
        </div>

        {invoice.notes && <p className="mt-3 text-[13px] text-muted-foreground">“{invoice.notes}”</p>}

        <div className="mt-4 flex justify-end gap-2.5">
          <Button variant="outline" onClick={onEdit} className="press h-10 rounded-full px-5"><Pencil className="h-4 w-4" /> Edit</Button>
          <Button onClick={onClose} className="press h-10 rounded-full px-6">Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

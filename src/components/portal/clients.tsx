"use client"

// ============================================================
// Clients & Vendors — the directory (finance roles).
// Outstanding balances derived from sent invoices.
// ============================================================

import { useMemo, useState } from "react"
import {
  Building2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Send,
  Trash2,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import {
  api,
  EmptyState,
  ErrorNote,
  fmtMoney,
  PageHeader,
  Pill,
  useApi,
  useCompany,
  type ClientT,
  type Me,
} from "./shared"
import { Skeleton } from "@/components/ui/skeleton"

type ListResponse = { clients: ClientT[] }

export function ClientsView({ me, onMutation }: { me: Me; onMutation: () => void }) {
  const { currency } = useCompany()
  const [search, setSearch] = useState("")
  const [type, setType] = useState("ALL")
  const [editing, setEditing] = useState<ClientT | "new" | null>(null)
  const [deleting, setDeleting] = useState<ClientT | null>(null)

  const url = useMemo(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set("q", search.trim())
    if (type !== "ALL") params.set("type", type)
    return `/api/clients?${params.toString()}`
  }, [search, type])

  const { data, loading, error, reload } = useApi<ListResponse>(url)

  async function toggleActive(client: ClientT) {
    try {
      await api(`/api/clients/${client.id}`, "PATCH", { isActive: !client.isActive })
      toast.success(!client.isActive ? `${client.name} reactivated` : `${client.name} deactivated`)
      await reload()
      onMutation()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update.")
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await api(`/api/clients/${deleting.id}`, "DELETE")
      toast.success("Client deleted")
      setDeleting(null)
      await reload()
      onMutation()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete.")
    }
  }

  const TABS = [
    { id: "ALL", label: "All" },
    { id: "CLIENT", label: "Clients" },
    { id: "VENDOR", label: "Vendors" },
  ]

  return (
    <div>
      <PageHeader title="Clients & Vendors" subtitle="Who you bill and who you pay.">
        <Button onClick={() => setEditing("new")} className="press h-10 rounded-full px-5 gap-1.5 shadow-md shadow-primary/25">
          <Plus className="h-4 w-4" /> Add {type === "VENDOR" ? "vendor" : "client"}
        </Button>
      </PageHeader>

      {/* Filter bar */}
      <div className="card-shadow mb-5 flex flex-wrap items-center gap-2.5 rounded-2xl border bg-card p-3">
        <div className="flex rounded-lg bg-muted p-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={cn(
                "press rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-all",
                type === t.id ? "bg-white text-foreground shadow-sm dark:bg-zinc-800" : "text-muted-foreground hover:text-foreground"
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
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or phone…"
            className="h-9 rounded-lg pl-9 bg-muted/50 border-transparent focus:bg-background"
          />
        </div>
      </div>

      {error && <ErrorNote message={error} />}

      {/* Cards grid */}
      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[196px] rounded-2xl" />
          ))}
        </div>
      ) : !data ? null : data.clients.length === 0 ? (
        <div className="card-shadow rounded-2xl border bg-card">
          <EmptyState icon={Users} title="No one here yet" description="Add your first client or vendor to start billing." />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.clients.map((c) => (
            <div
              key={c.id}
              className={cn(
                "card-shadow press rounded-2xl border bg-card p-5 hover:card-shadow-hover",
                !c.isActive && "opacity-60"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    {c.type === "VENDOR" ? <Building2 className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold leading-tight">{c.name}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Pill tone={c.type === "VENDOR" ? "violet" : "blue"}>{c.type === "VENDOR" ? "Vendor" : "Client"}</Pill>
                      {!c.isActive && <Pill tone="gray">Inactive</Pill>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  <button onClick={() => setEditing(c)} title="Edit" className="press rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
                    <Pencil className="h-4 w-4" />
                  </button>
                  {me.capabilities.canDeleteRecords && (
                    <button onClick={() => setDeleting(c)} title="Delete" className="press rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-1.5 text-[13px] text-muted-foreground">
                {c.email && <p className="flex items-center gap-2 truncate"><Mail className="h-3.5 w-3.5 shrink-0" /> {c.email}</p>}
                {c.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 shrink-0" /> {c.phone}</p>}
                {c.address && <p className="flex items-center gap-2 truncate"><MapPin className="h-3.5 w-3.5 shrink-0" /> {c.address}</p>}
              </div>

              <div className="mt-4 flex items-end justify-between border-t border-border/50 pt-3.5">
                <div>
                  <p className="micro-label">Outstanding</p>
                  <p className={cn("num mt-0.5 text-[16px] font-semibold", c.outstanding > 0 ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground")}>
                    {fmtMoney(c.outstanding, currency)}
                  </p>
                  {c.openInvoices > 0 && (
                    <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-muted-foreground">
                      <Send className="h-3 w-3" /> {c.openInvoices} open invoice{c.openInvoices > 1 ? "s" : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {c.lifetimeBilled > 0 && (
                    <p className="text-right text-[11.5px] text-muted-foreground">
                      Lifetime<br /><span className="num font-semibold text-foreground">{fmtMoney(c.lifetimeBilled, currency)}</span>
                    </p>
                  )}
                  <Switch checked={c.isActive} onCheckedChange={() => toggleActive(c)} aria-label="Toggle active" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / edit dialog */}
      {editing !== null && (
        <ClientDialog
          client={editing === "new" ? null : editing}
          defaultType={type === "VENDOR" ? "VENDOR" : "CLIENT"}
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
            <AlertDialogTitle>Delete {deleting?.type === "VENDOR" ? "vendor" : "client"}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.name} will be permanently removed. Clients with billing history can only be deactivated.
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

function ClientDialog({
  client,
  defaultType,
  onClose,
  onSaved,
}: {
  client: ClientT | null
  defaultType: "CLIENT" | "VENDOR"
  onClose: () => void
  onSaved: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState(client?.name ?? "")
  const [type, setType] = useState<"CLIENT" | "VENDOR">(client?.type ?? defaultType)
  const [email, setEmail] = useState(client?.email ?? "")
  const [phone, setPhone] = useState(client?.phone ?? "")
  const [address, setAddress] = useState(client?.address ?? "")
  const [notes, setNotes] = useState(client?.notes ?? "")

  async function save() {
    setBusy(true)
    try {
      const body = { name, type, email, phone, address, notes }
      if (client) {
        await api(`/api/clients/${client.id}`, "PATCH", body)
        toast.success("Saved")
      } else {
        await api("/api/clients", "POST", body)
        toast.success(`${type === "VENDOR" ? "Vendor" : "Client"} added`)
      }
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.")
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[440px] rounded-[20px] p-6">
        <DialogHeader>
          <DialogTitle className="tracking-tight">{client ? `Edit ${client.name}` : `New ${type === "VENDOR" ? "vendor" : "client"}`}</DialogTitle>
          <DialogDescription>{client ? "Update the details below." : "Contact details are optional."}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label className="text-[13px]">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sharma Family" className="h-10 rounded-lg" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as "CLIENT" | "VENDOR")}>
                <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLIENT">Client — we bill them</SelectItem>
                  <SelectItem value="VENDOR">Vendor — we pay them</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" className="h-10 rounded-lg" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[13px]">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="billing@company.com" className="h-10 rounded-lg" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[13px]">Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city" className="h-10 rounded-lg" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[13px]">Notes <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Anything useful…" className="rounded-lg" />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="outline" onClick={onClose} className="press h-10 rounded-full px-5">Cancel</Button>
          <Button onClick={save} disabled={busy || !name.trim()} className="press h-10 rounded-full px-6">{client ? "Save changes" : "Add"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

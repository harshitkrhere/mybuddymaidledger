"use client"

// ============================================================
// Spotlight — Apple-style universal command & search palette (Cmd+K).
// Real-time federated search across all modules with keyboard routing.
// ============================================================

import React, { useEffect, useState, useTransition } from "react"
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  Calendar,
  Command as CommandIcon,
  FileText,
  LayoutDashboard,
  Loader2,
  Mail,
  Moon,
  Phone,
  Plus,
  ScrollText,
  Search,
  Settings as SettingsIcon,
  Sun,
  User,
  UserCog,
  Users,
  Wallet,
} from "lucide-react"
import { useTheme } from "next-themes"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { api, fmtDate, fmtMoney, RoleBadge, useCompany, type Me, type ViewId } from "./shared"
import { HighlightMatch } from "./search-input"

interface SearchResponse {
  query: string
  results: {
    actions: Array<{ id: string; title: string; subtitle: string; view: ViewId; action?: string; icon: string }>
    transactions: Array<{
      id: string
      type: string
      amount: number
      description: string
      reference: string | null
      date: string
      client: { name: string } | null
      category: { name: string } | null
    }>
    invoices: Array<{
      id: string
      number: string
      status: string
      total: number
      issueDate: string
      client: { name: string }
    }>
    expenses: Array<{
      id: string
      description: string
      amount: number
      status: string
      date: string
      category: { name: string } | null
      submitter: { name: string }
    }>
    clients: Array<{
      id: string
      name: string
      type: string
      email: string | null
      phone: string | null
    }>
    team: Array<{
      id: string
      name: string
      email: string
      role: string
      title: string | null
      status: string
    }>
  }
  counts: {
    total: number
    actions: number
    transactions: number
    invoices: number
    expenses: number
    clients: number
    team: number
  }
}

interface SpotlightDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (view: ViewId, action?: string, query?: string) => void
  me: Me
}

export function SpotlightDialog({
  open,
  onOpenChange,
  onNavigate,
  me,
}: SpotlightDialogProps) {
  const { currency } = useCompany()
  const { theme, setTheme } = useTheme()
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<SearchResponse | null>(null)
  const [isPending, startTransition] = useTransition()

  // Register global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onOpenChange])

  // Debounced search fetch
  useEffect(() => {
    if (!open) {
      setQuery("")
      return
    }

    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const url = `/api/search?q=${encodeURIComponent(query.trim())}`
        const res = await api<SearchResponse>(url)
        startTransition(() => {
          setData(res)
        })
      } catch (err) {
        console.error("Search failed:", err)
      } finally {
        setLoading(false)
      }
    }, query.trim() ? 200 : 0)

    return () => clearTimeout(timer)
  }, [query, open])

  function selectAction(view: ViewId, action?: string, q?: string) {
    onOpenChange(false)
    onNavigate(view, action, q)
  }

  const results = data?.results
  const counts = data?.counts
  const hasResults = counts && counts.total > 0

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Spotlight Search"
      description="Search across transactions, invoices, expenses, clients and actions"
      className="max-w-[620px] rounded-2xl border border-black/10 bg-background/95 p-0 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-900/95"
    >
      <div className="relative border-b border-border/60">
        <CommandInput
          placeholder="Search anything or jump to... (e.g. Acme, INV-001, ₹5000)"
          value={query}
          onValueChange={setQuery}
          className="h-13 text-[14px]"
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      <CommandList className="max-h-[380px] p-2">
        {!loading && !hasResults && query.trim() && (
          <CommandEmpty className="py-12 text-center text-sm">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground">No matches for &ldquo;{query}&rdquo;</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Try searching by invoice number, client name, description, or amount.
            </p>
          </CommandEmpty>
        )}

        {/* Quick Actions / Navigation */}
        {results?.actions && results.actions.length > 0 && (
          <CommandGroup heading="Actions & Navigation">
            {results.actions.map((act) => (
              <CommandItem
                key={act.id}
                onSelect={() => selectAction(act.view, act.action)}
                className="flex items-center justify-between rounded-xl px-3 py-2.5 text-[13px] hover:bg-accent cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {act.icon === "LayoutDashboard" && <LayoutDashboard className="h-4 w-4" />}
                    {act.icon === "ArrowLeftRight" && <ArrowLeftRight className="h-4 w-4" />}
                    {act.icon === "FileText" && <FileText className="h-4 w-4" />}
                    {act.icon === "Wallet" && <Wallet className="h-4 w-4" />}
                    {act.icon === "Users" && <Users className="h-4 w-4" />}
                    {act.icon === "BarChart3" && <BarChart3 className="h-4 w-4" />}
                    {act.icon === "UserCog" && <UserCog className="h-4 w-4" />}
                    {act.icon === "ScrollText" && <ScrollText className="h-4 w-4" />}
                    {act.icon === "Settings" && <SettingsIcon className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      <HighlightMatch text={act.title} query={query} />
                    </p>
                    <p className="text-[11.5px] text-muted-foreground">{act.subtitle}</p>
                  </div>
                </div>
                {act.action === "new" && (
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10.5px] font-semibold text-primary">
                    Create
                  </span>
                )}
              </CommandItem>
            ))}

            <CommandItem
              onSelect={() => {
                setTheme(theme === "dark" ? "light" : "dark")
                onOpenChange(false)
              }}
              className="flex items-center justify-between rounded-xl px-3 py-2.5 text-[13px] hover:bg-accent cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </div>
                <div>
                  <p className="font-medium text-foreground">Switch to {theme === "dark" ? "Light" : "Dark"} Mode</p>
                  <p className="text-[11.5px] text-muted-foreground">Toggle visual appearance theme</p>
                </div>
              </div>
            </CommandItem>
          </CommandGroup>
        )}

        {/* Transactions */}
        {results?.transactions && results.transactions.length > 0 && (
          <CommandGroup heading={`Transactions (${results.transactions.length})`}>
            {results.transactions.map((tx) => (
              <CommandItem
                key={tx.id}
                onSelect={() => selectAction("transactions", undefined, tx.description)}
                className="flex items-center justify-between rounded-xl px-3 py-2.5 text-[13px] hover:bg-accent cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      tx.type === "INCOME"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-red-500/10 text-red-600 dark:text-red-400"
                    }`}
                  >
                    {tx.type === "INCOME" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      <HighlightMatch text={tx.description} query={query} />
                    </p>
                    <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
                      {tx.client?.name && (
                        <span>
                          <HighlightMatch text={tx.client.name} query={query} />
                        </span>
                      )}
                      {tx.category?.name && <span>• {tx.category.name}</span>}
                      <span>• {fmtDate(tx.date)}</span>
                    </div>
                  </div>
                </div>
                <span
                  className={`shrink-0 font-semibold font-mono text-[13px] ${
                    tx.type === "INCOME" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
                  }`}
                >
                  {tx.type === "INCOME" ? "+" : "-"}
                  {fmtMoney(tx.amount, currency)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Invoices */}
        {results?.invoices && results.invoices.length > 0 && (
          <CommandGroup heading={`Invoices (${results.invoices.length})`}>
            {results.invoices.map((inv) => (
              <CommandItem
                key={inv.id}
                onSelect={() => selectAction("invoices", undefined, inv.number)}
                className="flex items-center justify-between rounded-xl px-3 py-2.5 text-[13px] hover:bg-accent cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-foreground">
                        <HighlightMatch text={inv.number} query={query} />
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.2 text-[10.5px] font-semibold ring-1 ring-inset ${
                          inv.status === "PAID"
                            ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20"
                            : inv.status === "SENT"
                            ? "bg-blue-500/10 text-blue-600 ring-blue-500/20"
                            : "bg-zinc-500/10 text-zinc-600 ring-zinc-500/20"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-muted-foreground truncate">
                      <HighlightMatch text={inv.client.name} query={query} /> • {fmtDate(inv.issueDate)}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 font-semibold font-mono text-[13px] text-foreground">
                  {fmtMoney(inv.total, currency)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Expenses */}
        {results?.expenses && results.expenses.length > 0 && (
          <CommandGroup heading={`Expenses (${results.expenses.length})`}>
            {results.expenses.map((exp) => (
              <CommandItem
                key={exp.id}
                onSelect={() => selectAction("expenses", undefined, exp.description)}
                className="flex items-center justify-between rounded-xl px-3 py-2.5 text-[13px] hover:bg-accent cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
                    <Wallet className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      <HighlightMatch text={exp.description} query={query} />
                    </p>
                    <p className="text-[11.5px] text-muted-foreground">
                      <HighlightMatch text={exp.submitter.name} query={query} />
                      {exp.category?.name && ` • ${exp.category.name}`} • {fmtDate(exp.date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span
                    className={`rounded-full px-2 py-0.2 text-[10.5px] font-semibold ring-1 ring-inset ${
                      exp.status === "APPROVED"
                        ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20"
                        : exp.status === "REJECTED"
                        ? "bg-red-500/10 text-red-600 ring-red-500/20"
                        : "bg-orange-500/10 text-orange-600 ring-orange-500/20"
                    }`}
                  >
                    {exp.status}
                  </span>
                  <span className="font-semibold font-mono text-[13px] text-foreground">
                    {fmtMoney(exp.amount, currency)}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Clients & Vendors */}
        {results?.clients && results.clients.length > 0 && (
          <CommandGroup heading={`Clients & Vendors (${results.clients.length})`}>
            {results.clients.map((c) => (
              <CommandItem
                key={c.id}
                onSelect={() => selectAction("clients", undefined, c.name)}
                className="flex items-center justify-between rounded-xl px-3 py-2.5 text-[13px] hover:bg-accent cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-foreground">
                        <HighlightMatch text={c.name} query={query} />
                      </p>
                      <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-semibold text-muted-foreground">
                        {c.type}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-muted-foreground truncate">
                      {c.email && (
                        <span>
                          <HighlightMatch text={c.email} query={query} />
                        </span>
                      )}
                      {c.phone && <span> • {c.phone}</span>}
                    </p>
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Team Members */}
        {results?.team && results.team.length > 0 && (
          <CommandGroup heading={`Team Members (${results.team.length})`}>
            {results.team.map((m) => (
              <CommandItem
                key={m.id}
                onSelect={() => selectAction("team", undefined, m.name)}
                className="flex items-center justify-between rounded-xl px-3 py-2.5 text-[13px] hover:bg-accent cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      <HighlightMatch text={m.name} query={query} />
                    </p>
                    <p className="text-[11.5px] text-muted-foreground truncate">
                      <HighlightMatch text={m.email} query={query} />
                      {m.title && ` • ${m.title}`}
                    </p>
                  </div>
                </div>
                <RoleBadge role={m.role} />
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>

      <div className="flex items-center justify-between border-t border-border/50 px-4 py-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>Navigate <kbd className="rounded border px-1">↑</kbd><kbd className="rounded border px-1">↓</kbd></span>
          <span>Select <kbd className="rounded border px-1">↵</kbd></span>
          <span>Close <kbd className="rounded border px-1">Esc</kbd></span>
        </div>
        <div className="flex items-center gap-1 font-medium">
          <CommandIcon className="h-3 w-3" />
          <span>Spotlight Search</span>
        </div>
      </div>
    </CommandDialog>
  )
}

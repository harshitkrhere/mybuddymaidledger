"use client"

// ============================================================
// Audit Log — the system's memory (Red & Admin only).
// ============================================================

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, History, Search, ScrollText } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ErrorNote,
  fmtDateTime,
  PageHeader,
  Pill,
  RoleBadge,
  TableSkeleton,
  useApi,
} from "./shared"
import { EmptyState } from "./shared"
import { DebouncedSearchInput, HighlightMatch } from "./search-input"

type ListResponse = {
  entries: {
    id: string
    actorId: string | null
    actor: { name: string; email: string; role: string } | null
    action: string
    targetType: string | null
    targetId: string | null
    targetLabel: string | null
    detail: string | null
    createdAt: string
  }[]
  actions: { action: string; count: number }[]
  pagination: { page: number; pages: number; total: number }
}

function actionTone(action: string): "gray" | "blue" | "green" | "red" | "orange" | "violet" {
  if (action.includes("BLOCKED")) return "red"
  if (action.includes("FAILED")) return "orange"
  if (action.includes("DELETED") || action.includes("DEACTIVATED") || action.includes("REJECTED")) return "red"
  if (action.includes("CREATED") || action.includes("APPROVED") || action.includes("ACTIVATED")) return "green"
  if (action.includes("ROLE") || action.includes("USER")) return "violet"
  if (action.includes("LOGIN") || action.includes("LOGOUT")) return "blue"
  return "gray"
}

function actionLabel(action: string): string {
  return action
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

function prettyDetail(detail: string | null): string[] {
  if (!detail) return []
  try {
    const parsed = JSON.parse(detail) as Record<string, unknown>
    return Object.entries(parsed).map(([k, v]) => {
      const key = k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).toLowerCase()
      let value = String(v)
      if (typeof v === "object" && v !== null) {
        const obj = v as Record<string, unknown>
        value = Object.entries(obj)
          .map(([ik, iv]) => `${ik}: ${iv}`)
          .join(" → ")
      }
      return `${key}: ${value}`
    })
  } catch {
    return [detail]
  }
}

export function AuditView() {
  const [search, setSearch] = useState("")
  const [action, setAction] = useState("ALL")
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<string | null>(null)

  const url = useMemo(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set("q", search.trim())
    if (action !== "ALL") params.set("action", action)
    params.set("page", String(page))
    return `/api/audit?${params.toString()}`
  }, [search, action, page])

  const { data, loading, error } = useApi<ListResponse>(url)

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Every login, role change, approval and financial mutation." />

      {/* Filter bar */}
      <div className="card-shadow mb-5 flex flex-wrap items-center gap-2.5 rounded-2xl border bg-card p-3">
        <DebouncedSearchInput
          value={search}
          onChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Search people, targets, emails or actions… (/)"
          loading={loading}
          totalResults={data?.pagination.total}
          className="min-w-[220px] flex-1"
        />
        <Select value={action} onValueChange={(v) => { setAction(v); setPage(1) }}>
          <SelectTrigger className="h-9 w-[210px] rounded-lg bg-muted/50 border-transparent"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All actions</SelectItem>
            {(data?.actions ?? []).map((a) => (
              <SelectItem key={a.action} value={a.action}>
                {actionLabel(a.action)} ({a.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="card-shadow overflow-hidden rounded-2xl border bg-card">
        {error && <ErrorNote message={error} />}
        {loading && !data ? (
          <TableSkeleton rows={8} />
        ) : !data ? null : data.entries.length === 0 ? (
          <EmptyState icon={ScrollText} title="Nothing logged here" description={search || action !== "ALL" ? "No entries match the filter." : "Activity will appear as the team uses the portal."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="micro-label px-5 py-3 font-semibold">When</th>
                  <th className="micro-label px-3 py-3 font-semibold">Who</th>
                  <th className="micro-label px-3 py-3 font-semibold">Action</th>
                  <th className="micro-label px-3 py-3 font-semibold">Target</th>
                  <th className="micro-label px-5 py-3 font-semibold">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {data.entries.map((e) => {
                  const details = prettyDetail(e.detail)
                  const isOpen = expanded === e.id
                  return (
                    <tr
                      key={e.id}
                      className={cn("cursor-pointer align-top transition-colors hover:bg-accent/50", isOpen && "bg-accent/40")}
                      onClick={() => details.length > 0 && setExpanded(isOpen ? null : e.id)}
                    >
                      <td className="whitespace-nowrap px-5 py-3.5 text-muted-foreground">{fmtDateTime(e.createdAt)}</td>
                      <td className="px-3 py-3.5">
                        {e.actor ? (
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[10.5px] font-semibold text-primary">
                              {e.actor.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                            </span>
                            <div>
                              <p className="font-medium leading-tight">
                                <HighlightMatch text={e.actor.name} query={search} />
                              </p>
                              <div className="mt-0.5"><RoleBadge role={e.actor.role} /></div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Unknown user</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5"><Pill tone={actionTone(e.action)}>{actionLabel(e.action)}</Pill></td>
                      <td className="max-w-[200px] px-3 py-3.5">
                        {e.targetLabel ? (
                          <div>
                            <p className="truncate font-medium">
                              <HighlightMatch text={e.targetLabel} query={search} />
                            </p>
                            {e.targetType && <p className="text-[11.5px] text-muted-foreground">{e.targetType.toLowerCase()}</p>}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {details.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : isOpen ? (
                          <ul className="space-y-0.5 text-[12.5px] text-muted-foreground">
                            {details.map((d, i) => (
                              <li key={i} className="num">{d}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <History className="h-3.5 w-3.5" />
                            {details.length} field{details.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {data && data.pagination.pages > 1 && (
          <div className="flex items-center justify-between border-t px-5 py-3">
            <p className="text-[12px] text-muted-foreground">Page {data.pagination.page} of {data.pagination.pages} · {data.pagination.total} entries</p>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="press h-8 rounded-lg"><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" disabled={page >= data.pagination.pages} onClick={() => setPage((p) => p + 1)} className="press h-8 rounded-lg"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

import { db } from "@/lib/db"
import { ok, requireRole, route } from "@/lib/api-helpers"

// ============================================================
// /api/audit — the system's memory (Red & Admin only).
// ============================================================

const PAGE_SIZE = 15

export const GET = route("audit.list", async (req) => {
  const guard = await requireRole("RED", "ADMIN")
  if ("response" in guard) return guard.response

  const url = new URL(req.url)
  const search = (url.searchParams.get("q") ?? "").trim().slice(0, 200)
  const action = url.searchParams.get("action")
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1)

  const where: Record<string, unknown> = {}
  if (action && action !== "ALL") where.action = action
  if (search) {
    where.OR = [
      { targetLabel: { contains: search, mode: "insensitive" } },
      { action: { contains: search, mode: "insensitive" } },
      { actor: { name: { contains: search, mode: "insensitive" } } },
      { actor: { email: { contains: search, mode: "insensitive" } } },
    ]
  }

  const [total, entries, actionGroups] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { actor: { select: { name: true, email: true, role: true } } },
    }),
    db.auditLog.groupBy({ by: ["action"], _count: { _all: true } }),
  ])

  return ok({
    entries,
    actions: actionGroups.map((g) => ({ action: g.action, count: g._count._all })).sort((a, b) =>
      a.action.localeCompare(b.action)
    ),
    pagination: { page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), total },
  })
})

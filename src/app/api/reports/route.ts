import { db } from "@/lib/db"
import { fail, ok, requireModule, route } from "@/lib/api-helpers"
import { parseWith, ReportQuerySchema } from "@/lib/validation"

// ============================================================
// /api/reports — P&L, category breakdown, cash-flow trend.
// Pass ?format=csv to download the ledger as CSV.
// Date-range params are validated before querying.
// ============================================================

export const GET = route("reports.get", async (req) => {
  const guard = await requireModule("reports")
  if ("response" in guard) return guard.response

  const url = new URL(req.url)
  const range = parseWith(ReportQuerySchema, {
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
  })
  if (!range.ok) return fail(400, range.error)

  const now = new Date()
  const from = range.value.from ? new Date(range.value.from) : new Date(now.getFullYear(), 0, 1)
  const to = range.value.to ? new Date(`${range.value.to}T23:59:59`) : new Date(now.getFullYear(), 11, 31, 23, 59, 59)

  // ---------------- CSV export ----------------
  if (url.searchParams.get("format") === "csv") {
    const rows = await db.transaction.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
      include: { category: true, client: { select: { name: true } } },
    })

    const esc = (v: string) => `"${v.replace(/"/g, '""')}"` // RFC 4180
    const header = ["Date", "Type", "Description", "Category", "Party", "Reference", "Method", "Amount"]
      .map(esc)
      .join(",")
    const lines = rows.map((r) =>
      [
        r.date.toISOString().slice(0, 10),
        r.type,
        r.description,
        r.category?.name ?? "Uncategorized",
        r.client?.name ?? "",
        r.reference ?? "",
        r.paymentMethod,
        String(r.amount),
      ]
        .map((v) => esc(String(v)))
        .join(",")
    )
    const csv = [header, ...lines].join("\n")

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ledger-${from.toISOString().slice(0, 10)}-to-${to.toISOString().slice(0, 10)}.csv"`,
      },
    })
  }

  // ---------------- Aggregate report ----------------
  const [incomeByCat, expenseByCat, monthly] = await Promise.all([
    db.transaction.groupBy({
      by: ["type", "categoryId"],
      where: { type: "INCOME", date: { gte: from, lte: to } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    }),
    db.transaction.groupBy({
      by: ["categoryId"],
      where: { type: "EXPENSE", date: { gte: from, lte: to } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    }),
    db.transaction.findMany({
      where: { date: { gte: from, lte: to } },
      select: { date: true, type: true, amount: true },
    }),
  ])

  const catIds = [...incomeByCat.map((g) => g.categoryId), ...expenseByCat.map((g) => g.categoryId)].filter(
    Boolean
  ) as string[]
  const categories = await db.category.findMany({ where: { id: { in: catIds } } })
  const nameOf = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Uncategorized"

  const totalIncome = incomeByCat.reduce((s, g) => s + (g._sum.amount ?? 0), 0)
  const totalExpense = expenseByCat.reduce((s, g) => s + (g._sum.amount ?? 0), 0)

  // Month buckets across the selected window
  const buckets: { month: string; income: number; expense: number; net: number }[] = []
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1)
  while (cursor <= to) {
    const start = new Date(cursor)
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59)
    const inRange = monthly.filter((t) => t.date >= start && t.date <= end)
    const income = inRange.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0)
    const expense = inRange.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0)
    buckets.push({
      month: start.toLocaleString("en-US", { month: "short", year: "2-digit" }),
      income,
      expense,
      net: income - expense,
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return ok({
    range: { from: from.toISOString(), to: to.toISOString() },
    summary: {
      totalIncome,
      totalExpense,
      net: totalIncome - totalExpense,
      margin: totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0,
      transactions: monthly.length,
    },
    incomeByCategory: incomeByCat.map((g) => ({ name: nameOf(g.categoryId), amount: g._sum.amount ?? 0 })),
    expenseByCategory: expenseByCat.map((g) => ({ name: nameOf(g.categoryId), amount: g._sum.amount ?? 0 })),
    monthly: buckets,
  })
})

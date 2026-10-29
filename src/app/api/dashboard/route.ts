import { db } from "@/lib/db"
import { ok, requireUser } from "@/lib/api-helpers"
import { canApproveExpenses } from "@/lib/permissions"

// ============================================================
// /api/dashboard — role-aware home view.
// Finance roles get the full financial picture; employees get
// a clean personal view of their own expense activity.
// ============================================================

function monthStart(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function lastNMonths(n: number) {
  const now = new Date()
  const months: { label: string; start: Date; end: Date }[] = []
  for (let i = n - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)
    months.push({ label: start.toLocaleString("en-US", { month: "short" }), start, end })
  }
  return months
}

export async function GET() {
  const guard = await requireUser()
  if ("response" in guard) return guard.response
  const user = guard.user
  const approver = canApproveExpenses(user.role)

  // ---------------- Employee view ----------------
  if (!approver) {
    const monthStartNow = monthStart()
    const [mine, monthMine, recent] = await Promise.all([
      db.expense.groupBy({
        by: ["status"],
        where: { submittedById: user.id },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      db.expense.findMany({
        where: { submittedById: user.id, date: { gte: monthStartNow } },
        select: { amount: true, status: true },
      }),
      db.expense.findMany({
        where: { submittedById: user.id },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 6,
        include: { category: true, reviewer: { select: { name: true } } },
      }),
    ])

    const stat = (s: string) => mine.find((m) => m.status === s)
    const monthApproved = monthMine
      .filter((e) => e.status === "APPROVED")
      .reduce((sum, e) => sum + e.amount, 0)

    return ok({
      scope: "personal",
      kpis: {
        totalSubmitted: mine.reduce((sum, m) => sum + m._count._all, 0),
        pending: stat("PENDING")?._count._all ?? 0,
        approved: stat("APPROVED")?._count._all ?? 0,
        rejected: stat("REJECTED")?._count._all ?? 0,
        approvedAmount: stat("APPROVED")?._sum.amount ?? 0,
        thisMonthApproved: monthApproved,
      },
      recentExpenses: recent,
    })
  }

  // ---------------- Finance / management view ----------------
  const monthStartNow = monthStart()
  const nextMonthStart = new Date(monthStartNow.getFullYear(), monthStartNow.getMonth() + 1, 1)

  const months = lastNMonths(12)
  const monthKeys = months.map((m) => m.start.toISOString())

  const [txAll, recentTx, pendingExpenses, invoiceGroups, expenseTxMonth, incomeTxMonth, cashAll, topExpenseCats] =
    await Promise.all([
      db.transaction.findMany({
        where: { date: { gte: months[0].start, lte: months[months.length - 1].end } },
        select: { date: true, type: true, amount: true },
      }),
      db.transaction.findMany({
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 7,
        include: {
          category: true,
          client: { select: { name: true } },
          createdBy: { select: { name: true } },
        },
      }),
      db.expense.findMany({
        where: { status: "PENDING" },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 6,
        include: {
          submitter: { select: { id: true, name: true, role: true } },
          category: true,
        },
      }),
      db.invoice.groupBy({
        by: ["status"],
        _sum: { total: true },
        _count: { _all: true },
      }),
      db.transaction.aggregate({
        where: { type: "EXPENSE", date: { gte: monthStartNow, lt: nextMonthStart } },
        _sum: { amount: true },
      }),
      db.transaction.aggregate({
        where: { type: "INCOME", date: { gte: monthStartNow, lt: nextMonthStart } },
        _sum: { amount: true },
      }),
      db.transaction.groupBy({
        by: ["type"],
        _sum: { amount: true },
      }),
      db.transaction.groupBy({
        by: ["categoryId"],
        where: { type: "EXPENSE", date: { gte: monthStartNow, lt: nextMonthStart } },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 5,
      }),
    ])

  // 12-month income/expense series
  const series = months.map((m) => {
    const inRange = txAll.filter(
      (t) => t.date >= m.start && t.date <= m.end
    )
    return {
      month: m.label,
      key: m.start.toISOString(),
      income: inRange.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0),
      expense: inRange.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0),
    }
  })

  const sumByType = (type: string) => cashAll.find((c) => c.type === type)?._sum.amount ?? 0
  const lifetimeIncome = sumByType("INCOME")
  const lifetimeExpense = sumByType("EXPENSE")

  const categoryIds = topExpenseCats.map((t) => t.categoryId).filter(Boolean)
  const categories = await db.category.findMany({ where: { id: { in: categoryIds } } })
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Uncategorized"

  const invStat = (s: string) => invoiceGroups.find((g) => g.status === s)
  const receivables = invStat("SENT")?._sum.total ?? 0

  const pendingExpenseTotal = await db.expense.aggregate({
    where: { status: "PENDING" },
    _sum: { amount: true },
  })
  const approvedUnpaid = await db.expense.aggregate({
    where: { status: "APPROVED" },
    _sum: { amount: true },
  })

  const thisMonthIncome = incomeTxMonth._sum.amount ?? 0
  const thisMonthExpense = expenseTxMonth._sum.amount ?? 0

  return ok({
    scope: "company",
    kpis: {
      revenue: thisMonthIncome,
      expenses: thisMonthExpense,
      net: thisMonthIncome - thisMonthExpense,
      cash: lifetimeIncome - lifetimeExpense,
      receivables,
      pendingPayouts: approvedUnpaid._sum.amount ?? 0,
    },
    series,
    monthKeys,
    recentTransactions: recentTx,
    pendingApprovals: pendingExpenses.map((e) => ({
      ...e,
      amountLabel: e.amount,
    })),
    pendingApprovalsTotal: pendingExpenseTotal._sum.amount ?? 0,
    invoices: {
      draft: invStat("DRAFT")?._count._all ?? 0,
      sent: invStat("SENT")?._count._all ?? 0,
      paid: invStat("PAID")?._count._all ?? 0,
      paidAmount: invStat("PAID")?._sum.total ?? 0,
    },
    topExpenseCategories: topExpenseCats.map((t) => ({
      name: catName(t.categoryId),
      amount: t._sum.amount ?? 0,
    })),
  })
}

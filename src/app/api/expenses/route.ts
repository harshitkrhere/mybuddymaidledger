import { db } from "@/lib/db"
import { audit } from "@/lib/auth"
import { fail, ok, readJson, requireUser, route } from "@/lib/api-helpers"
import { canApproveExpenses } from "@/lib/permissions"
import { ExpenseSchema, parseWith } from "@/lib/validation"

// ============================================================
// /api/expenses — everyone can submit their own expenses.
// Approvers (Red / Admin / Manager) review submissions.
// Employees are hard-scoped to their own records — the query
// filter below is the tenant boundary for this module.
// ============================================================

const PAGE_SIZE = 10

export const GET = route("expenses.list", async (req) => {
  const guard = await requireUser()
  if ("response" in guard) return guard.response
  const user = guard.user
  const isApprover = canApproveExpenses(user.role)

  const url = new URL(req.url)
  const status = url.searchParams.get("status")
  const categoryId = url.searchParams.get("categoryId")
  const submittedById = url.searchParams.get("submittedById")
  const search = (url.searchParams.get("q") ?? "").trim().slice(0, 200)
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1)

  const where: Record<string, unknown> = {}
  // Employees are hard-scoped to their own submissions.
  if (!isApprover) where.submittedById = user.id
  else if (submittedById) where.submittedById = submittedById
  if (status && ["PENDING", "APPROVED", "REJECTED"].includes(status)) where.status = status
  if (categoryId) where.categoryId = categoryId
  if (search) {
    const cleanNum = parseFloat(search.replace(/[₹$,\s]/g, ""))
    const hasNum = !isNaN(cleanNum) && cleanNum > 0
    where.OR = [
      { description: { contains: search, mode: "insensitive" } },
      { receiptRef: { contains: search, mode: "insensitive" } },
      { category: { name: { contains: search, mode: "insensitive" } } },
      { submitter: { name: { contains: search, mode: "insensitive" } } },
      ...(hasNum ? [{ amount: { gte: cleanNum * 0.999, lte: cleanNum * 1.001 } }] : []),
    ]
  }

  const [total, expenses, categories, submitters, pendingCount] = await Promise.all([
    db.expense.count({ where }),
    db.expense.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        category: true,
        submitter: { select: { id: true, name: true, role: true } },
        reviewer: { select: { id: true, name: true } },
      },
    }),
    db.category.findMany({ where: { isActive: true, type: "EXPENSE" }, orderBy: { name: "asc" } }),
    isApprover
      ? db.user.findMany({
          where: { status: "ACTIVE" },
          orderBy: { name: "asc" },
          select: { id: true, name: true, role: true },
        })
      : Promise.resolve([]),
    db.expense.count({ where: isApprover ? { status: "PENDING" } : { status: "PENDING", submittedById: user.id } }),
  ])

  // Totals across the active filter.
  const totals = await db.expense.groupBy({
    by: ["status"],
    where,
    _sum: { amount: true },
  })
  const sumOf = (s: string) => totals.find((t) => t.status === s)?._sum.amount ?? 0

  return ok({
    expenses,
    categories,
    submitters,
    isApprover,
    pendingCount,
    pagination: { page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), total },
    totals: {
      pending: sumOf("PENDING"),
      approved: sumOf("APPROVED"),
      rejected: sumOf("REJECTED"),
    },
  })
})

export const POST = route("expenses.create", async (req) => {
  const guard = await requireUser()
  if ("response" in guard) return guard.response
  const user = guard.user

  const parsed = parseWith(ExpenseSchema, await readJson(req))
  if (!parsed.ok) return fail(400, parsed.error)
  const body = parsed.value

  if (body.categoryId && !(await db.category.findUnique({ where: { id: body.categoryId } }))) {
    return fail(400, "That category no longer exists.")
  }

  const expense = await db.expense.create({
    data: {
      submittedById: user.id,
      date: new Date(body.date),
      amount: body.amount,
      description: body.description,
      categoryId: body.categoryId,
      receiptRef: body.receiptRef,
    },
    include: {
      category: true,
      submitter: { select: { id: true, name: true, role: true } },
      reviewer: { select: { id: true, name: true } },
    },
  })

  await audit({
    actorId: user.id,
    action: "EXPENSE_SUBMITTED",
    targetType: "EXPENSE",
    targetId: expense.id,
    targetLabel: expense.description,
    detail: { amount: expense.amount, date: expense.date },
  })

  return ok({ expense }, 201)
})

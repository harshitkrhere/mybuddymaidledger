import { db } from "@/lib/db"
import { audit } from "@/lib/auth"
import { fail, ok, readJson, requireModule, route } from "@/lib/api-helpers"
import { parseWith, TransactionSchema } from "@/lib/validation"

// ============================================================
// /api/transactions — the income/expense ledger (finance roles).
// Employees have no access to this module at all.
// Every payload is Zod-validated before touching the database.
// ============================================================

const PAGE_SIZE = 12

export const GET = route("transactions.list", async (req) => {
  const guard = await requireModule("transactions")
  if ("response" in guard) return guard.response

  const url = new URL(req.url)
  const type = url.searchParams.get("type") // INCOME | EXPENSE | (all)
  const categoryId = url.searchParams.get("categoryId")
  const from = url.searchParams.get("from")
  const to = url.searchParams.get("to")
  const search = (url.searchParams.get("q") ?? "").trim().slice(0, 200)
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1)

  const where: Record<string, unknown> = {}
  if (type === "INCOME" || type === "EXPENSE") where.type = type
  if (categoryId) where.categoryId = categoryId
  if (from || to) {
    where.date = {
      ...(from && !isNaN(Date.parse(from)) ? { gte: new Date(from) } : {}),
      ...(to && !isNaN(Date.parse(to)) ? { lte: new Date(`${to}T23:59:59`) } : {}),
    }
  }
  if (search) {
    const cleanNum = parseFloat(search.replace(/[₹$,\s]/g, ""))
    const hasNum = !isNaN(cleanNum) && cleanNum > 0
    where.OR = [
      { description: { contains: search, mode: "insensitive" } },
      { reference: { contains: search, mode: "insensitive" } },
      { client: { name: { contains: search, mode: "insensitive" } } },
      { category: { name: { contains: search, mode: "insensitive" } } },
      ...(hasNum ? [{ amount: { gte: cleanNum * 0.999, lte: cleanNum * 1.001 } }] : []),
    ]
  }

  const [total, transactions, categories, clients] = await Promise.all([
    db.transaction.count({ where }),
    db.transaction.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        category: true,
        client: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    }),
    db.category.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.client.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, type: true } }),
  ])

  // Ledger totals for the active filter (all matching rows, not just this page).
  const totals = await db.transaction.groupBy({
    by: ["type"],
    where,
    _sum: { amount: true },
  })
  const income = totals.find((t) => t.type === "INCOME")?._sum.amount ?? 0
  const expense = totals.find((t) => t.type === "EXPENSE")?._sum.amount ?? 0

  return ok({
    transactions,
    categories,
    clients,
    pagination: { page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), total },
    totals: { income, expense, net: income - expense },
  })
})

export const POST = route("transactions.create", async (req) => {
  const guard = await requireModule("transactions")
  if ("response" in guard) return guard.response
  const actor = guard.user

  const parsed = parseWith(TransactionSchema, await readJson(req))
  if (!parsed.ok) return fail(400, parsed.error)
  const body = parsed.value

  // Referential integrity: optional category / client must exist.
  if (body.categoryId && !(await db.category.findUnique({ where: { id: body.categoryId } }))) {
    return fail(400, "That category no longer exists.")
  }
  if (body.clientId && !(await db.client.findUnique({ where: { id: body.clientId } }))) {
    return fail(400, "That client no longer exists.")
  }

  const tx = await db.transaction.create({
    data: {
      date: new Date(body.date),
      type: body.type,
      amount: body.amount,
      description: body.description,
      categoryId: body.categoryId,
      clientId: body.clientId,
      reference: body.reference,
      paymentMethod: body.paymentMethod,
      createdById: actor.id,
    },
    include: {
      category: true,
      client: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  await audit({
    actorId: actor.id,
    action: "TRANSACTION_CREATED",
    targetType: "TRANSACTION",
    targetId: tx.id,
    targetLabel: tx.description,
    detail: { type: tx.type, amount: tx.amount, date: tx.date },
  })

  return ok({ transaction: tx }, 201)
})

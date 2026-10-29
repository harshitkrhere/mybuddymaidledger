import { db } from "@/lib/db"
import { audit } from "@/lib/auth"
import { fail, ok, readJson, requireModule } from "@/lib/api-helpers"
import { validateTxBody } from "@/lib/finance-validation"

// ============================================================
// /api/transactions — the income/expense ledger (finance roles).
// Employees have no access to this module at all.
// ============================================================

const PAGE_SIZE = 12

export async function GET(req: Request) {
  const guard = await requireModule("transactions")
  if ("response" in guard) return guard.response

  const url = new URL(req.url)
  const type = url.searchParams.get("type") // INCOME | EXPENSE | (all)
  const categoryId = url.searchParams.get("categoryId")
  const from = url.searchParams.get("from")
  const to = url.searchParams.get("to")
  const search = (url.searchParams.get("q") ?? "").trim()
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1)

  const where: Record<string, unknown> = {}
  if (type === "INCOME" || type === "EXPENSE") where.type = type
  if (categoryId) where.categoryId = categoryId
  if (from || to) {
    where.date = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}),
    }
  }
  if (search) {
    where.OR = [
      { description: { contains: search } },
      { reference: { contains: search } },
      { client: { name: { contains: search } } },
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
}

type TxBody = {
  date?: string
  type?: string
  amount?: number
  description?: string
  categoryId?: string | null
  clientId?: string | null
  reference?: string | null
  paymentMethod?: string
}

export async function POST(req: Request) {
  const guard = await requireModule("transactions")
  if ("response" in guard) return guard.response
  const actor = guard.user

  const body = await readJson<TxBody>(req)
  const error = validateTxBody(body)
  if (error) return fail(400, error)

  const tx = await db.transaction.create({
    data: {
      date: new Date(body!.date!),
      type: body!.type!,
      amount: body!.amount!,
      description: body!.description!.trim(),
      categoryId: body!.categoryId || null,
      clientId: body!.clientId || null,
      reference: (body!.reference ?? "").trim() || null,
      paymentMethod: body!.paymentMethod ?? "BANK",
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
}

import { db } from "@/lib/db"
import { audit } from "@/lib/auth"
import { fail, ok, readJson, requireModule } from "@/lib/api-helpers"
import { computeInvoiceTotals, validateInvoiceBody } from "@/lib/finance-validation"

// ============================================================
// /api/invoices — billing (finance roles). Employees: no access.
// Statuses: DRAFT -> SENT -> PAID (OVERDUE derived on read).
// ============================================================

const PAGE_SIZE = 10

export async function GET(req: Request) {
  const guard = await requireModule("invoices")
  if ("response" in guard) return guard.response

  const url = new URL(req.url)
  const status = url.searchParams.get("status")
  const clientId = url.searchParams.get("clientId")
  const search = (url.searchParams.get("q") ?? "").trim()
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1)

  const where: Record<string, unknown> = {}
  if (status && ["DRAFT", "SENT", "PAID"].includes(status)) where.status = status
  if (clientId) where.clientId = clientId
  if (search) {
    where.OR = [{ number: { contains: search } }, { client: { name: { contains: search } } }]
  }

  const [total, invoices, clients] = await Promise.all([
    db.invoice.count({ where }),
    db.invoice.findMany({
      where,
      orderBy: { issueDate: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        client: { select: { id: true, name: true, type: true } },
        createdBy: { select: { id: true, name: true } },
      },
    }),
    db.client.findMany({ where: { isActive: true, type: "CLIENT" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ])

  const totals = await db.invoice.groupBy({
    by: ["status"],
    where,
    _sum: { total: true },
    _count: { _all: true },
  })
  const sumOf = (s: string) => totals.find((t) => t.status === s)?._sum.total ?? 0
  const countOf = (s: string) => totals.find((t) => t.status === s)?._count._all ?? 0

  return ok({
    invoices,
    clients,
    pagination: { page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), total },
    totals: {
      draft: sumOf("DRAFT"),
      sent: sumOf("SENT"),
      paid: sumOf("PAID"),
      drafts: countOf("DRAFT"),
      sents: countOf("SENT"),
      paids: countOf("PAID"),
    },
  })
}

async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const count = await db.invoice.count()
  // Robust against gaps: find max sequence for this year.
  const latest = await db.invoice.findFirst({
    where: { number: { startsWith: `INV-${year}-` } },
    orderBy: { number: "desc" },
    select: { number: true },
  })
  const lastSeq = latest ? Number(latest.number.split("-")[2]) : 0
  const seq = Math.max(count, lastSeq) + 1
  return `INV-${year}-${String(seq).padStart(4, "0")}`
}

export async function POST(req: Request) {
  const guard = await requireModule("invoices")
  if ("response" in guard) return guard.response
  const actor = guard.user

  const body = await readJson<Parameters<typeof validateInvoiceBody>[0]>(req)
  const error = validateInvoiceBody(body)
  if (error) return fail(400, error)

  const client = await db.client.findUnique({ where: { id: body!.clientId! } })
  if (!client) return fail(400, "That client no longer exists.")

  const taxRate = body!.taxRate ?? 18
  const { lines, subtotal, taxAmount, total } = computeInvoiceTotals(body!.items!, taxRate)
  const number = await nextInvoiceNumber()

  const invoice = await db.invoice.create({
    data: {
      number,
      clientId: client.id,
      issueDate: new Date(body!.issueDate!),
      dueDate: body!.dueDate ? new Date(body!.dueDate) : null,
      notes: (body!.notes ?? "").trim() || null,
      taxRate,
      subtotal,
      taxAmount,
      total,
      createdById: actor.id,
      items: { create: lines },
    },
    include: {
      client: { select: { id: true, name: true, type: true } },
      createdBy: { select: { id: true, name: true } },
      items: true,
    },
  })

  await audit({
    actorId: actor.id,
    action: "INVOICE_CREATED",
    targetType: "INVOICE",
    targetId: invoice.id,
    targetLabel: invoice.number,
    detail: { client: client.name, total },
  })

  return ok({ invoice }, 201)
}

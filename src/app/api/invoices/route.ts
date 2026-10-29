import { db } from "@/lib/db"
import { audit } from "@/lib/auth"
import { fail, ok, readJson, requireModule, route } from "@/lib/api-helpers"
import { computeInvoiceTotals, InvoiceSchema, parseWith } from "@/lib/validation"

// ============================================================
// /api/invoices — billing (finance roles). Employees: no access.
// Statuses: DRAFT -> SENT -> PAID (OVERDUE derived on read).
//
// Transaction safety:
//   · invoice number allocation + row creation run inside ONE
//     database transaction, and a unique-number collision under
//     concurrency is retried with a fresh sequence — two users
//     creating invoices at the same instant can never collide.
//   · money math (subtotal / tax / total) is computed server-side
//     from the line items; clients never dictate totals.
// ============================================================

const PAGE_SIZE = 10

export const GET = route("invoices.list", async (req) => {
  const guard = await requireModule("invoices")
  if ("response" in guard) return guard.response

  const url = new URL(req.url)
  const status = url.searchParams.get("status")
  const clientId = url.searchParams.get("clientId")
  const search = (url.searchParams.get("q") ?? "").trim().slice(0, 200)
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1)

  const where: Record<string, unknown> = {}
  if (status && ["DRAFT", "SENT", "PAID"].includes(status)) where.status = status
  if (clientId) where.clientId = clientId
  if (search) {
    const cleanNum = parseFloat(search.replace(/[₹$,\s]/g, ""))
    const hasNum = !isNaN(cleanNum) && cleanNum > 0
    where.OR = [
      { number: { contains: search, mode: "insensitive" } },
      { client: { name: { contains: search, mode: "insensitive" } } },
      { client: { email: { contains: search, mode: "insensitive" } } },
      { notes: { contains: search, mode: "insensitive" } },
      { items: { some: { description: { contains: search, mode: "insensitive" } } } },
      ...(hasNum ? [{ total: { gte: cleanNum * 0.999, lte: cleanNum * 1.001 } }] : []),
    ]
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
})

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0]

async function nextInvoiceNumber(tx: Tx): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `INV-${year}-`
  // Robust against gaps: find the highest sequence for this year.
  const latest = await tx.invoice.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  })
  const lastSeq = latest ? Number(latest.number.slice(prefix.length)) : 0
  if (!Number.isFinite(lastSeq)) return `${prefix}0001`
  return `${prefix}${String(lastSeq + 1).padStart(4, "0")}`
}

export const POST = route("invoices.create", async (req) => {
  const guard = await requireModule("invoices")
  if ("response" in guard) return guard.response
  const actor = guard.user

  const parsed = parseWith(InvoiceSchema, await readJson(req))
  if (!parsed.ok) return fail(400, parsed.error)
  const body = parsed.value

  const client = await db.client.findUnique({ where: { id: body.clientId } })
  if (!client) return fail(400, "That client no longer exists.")

  const { lines, subtotal, taxAmount, total } = computeInvoiceTotals(body.items, body.taxRate)

  // Race-proof creation: allocation + insert inside one transaction;
  // a concurrent creator winning the same number triggers P2002 and
  // we retry with a freshly allocated sequence.
  let invoice = null as Awaited<ReturnType<typeof db.invoice.create>> | null
  for (let attempt = 0; attempt < 3 && !invoice; attempt++) {
    try {
      invoice = await db.$transaction(async (tx) => {
        const number = await nextInvoiceNumber(tx)
        return tx.invoice.create({
          data: {
            number,
            clientId: client.id,
            issueDate: new Date(body.issueDate),
            dueDate: body.dueDate ? new Date(body.dueDate) : null,
            notes: body.notes,
            taxRate: body.taxRate,
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
      })
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code !== "P2002") throw err // only the unique-number race is retried
    }
  }
  if (!invoice) return fail(409, "Couldn't allocate an invoice number — please try again.")

  await audit({
    actorId: actor.id,
    action: "INVOICE_CREATED",
    targetType: "INVOICE",
    targetId: invoice.id,
    targetLabel: invoice.number,
    detail: { client: client.name, total },
  })

  return ok({ invoice }, 201)
})

import { db } from "@/lib/db"
import { audit } from "@/lib/auth"
import { fail, ok, readJson, requireModule, route } from "@/lib/api-helpers"
import { ClientSchema, parseWith } from "@/lib/validation"

// ============================================================
// /api/clients — clients & vendors directory (finance roles).
// Outstanding balance per client derived from SENT invoices.
// ============================================================

export const GET = route("clients.list", async (req) => {
  const guard = await requireModule("clients")
  if ("response" in guard) return guard.response

  const url = new URL(req.url)
  const type = url.searchParams.get("type") // CLIENT | VENDOR | (all)
  const search = (url.searchParams.get("q") ?? "").trim().slice(0, 200)

  const where: Record<string, unknown> = {}
  if (type === "CLIENT" || type === "VENDOR") where.type = type
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
      { address: { contains: search, mode: "insensitive" } },
      { notes: { contains: search, mode: "insensitive" } },
    ]
  }

  const clients = await db.client.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      _count: { select: { invoices: true, transactions: true } },
    },
  })

  // Outstanding = unpaid invoices (SENT + past-due drafts excluded).
  const unpaid = await db.invoice.groupBy({
    by: ["clientId"],
    where: { status: "SENT" },
    _sum: { total: true },
    _count: { _all: true },
  })
  const outstandingByClient = new Map(unpaid.map((u) => [u.clientId, u]))
  const billedByClient = await db.invoice.groupBy({
    by: ["clientId"],
    where: { status: "PAID" },
    _sum: { total: true },
  })
  const billedMap = new Map(billedByClient.map((b) => [b.clientId, b._sum.total ?? 0]))

  return ok({
    clients: clients.map((c) => ({
      ...c,
      outstanding: outstandingByClient.get(c.id)?._sum.total ?? 0,
      openInvoices: outstandingByClient.get(c.id)?._count._all ?? 0,
      lifetimeBilled: billedMap.get(c.id) ?? 0,
    })),
  })
})

export const POST = route("clients.create", async (req) => {
  const guard = await requireModule("clients")
  if ("response" in guard) return guard.response
  const actor = guard.user

  const parsed = parseWith(ClientSchema, await readJson(req))
  if (!parsed.ok) return fail(400, parsed.error)
  const body = parsed.value

  const client = await db.client.create({
    data: {
      name: body.name,
      type: body.type,
      email: body.email,
      phone: body.phone,
      address: body.address,
      notes: body.notes,
    },
  })

  await audit({
    actorId: actor.id,
    action: "CLIENT_CREATED",
    targetType: "CLIENT",
    targetId: client.id,
    targetLabel: client.name,
    detail: { type: body.type },
  })

  return ok({ client }, 201)
})

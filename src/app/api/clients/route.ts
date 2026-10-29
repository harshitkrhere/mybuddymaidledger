import { db } from "@/lib/db"
import { audit } from "@/lib/auth"
import { fail, ok, readJson, requireModule } from "@/lib/api-helpers"

// ============================================================
// /api/clients — clients & vendors directory (finance roles).
// Outstanding balance per client derived from SENT invoices.
// ============================================================

export async function GET(req: Request) {
  const guard = await requireModule("clients")
  if ("response" in guard) return guard.response

  const url = new URL(req.url)
  const type = url.searchParams.get("type") // CLIENT | VENDOR | (all)
  const search = (url.searchParams.get("q") ?? "").trim()

  const where: Record<string, unknown> = {}
  if (type === "CLIENT" || type === "VENDOR") where.type = type
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { phone: { contains: search } },
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
}

type ClientBody = {
  name?: string
  type?: string
  email?: string
  phone?: string
  address?: string
  notes?: string
}

export async function POST(req: Request) {
  const guard = await requireModule("clients")
  if ("response" in guard) return guard.response
  const actor = guard.user

  const body = await readJson<ClientBody>(req)
  const name = (body?.name ?? "").trim()
  const type = body?.type ?? "CLIENT"
  if (!name) return fail(400, "Please enter a name.")
  if (type !== "CLIENT" && type !== "VENDOR") return fail(400, "Type must be client or vendor.")

  const client = await db.client.create({
    data: {
      name,
      type,
      email: (body?.email ?? "").trim() || null,
      phone: (body?.phone ?? "").trim() || null,
      address: (body?.address ?? "").trim() || null,
      notes: (body?.notes ?? "").trim() || null,
    },
  })

  await audit({
    actorId: actor.id,
    action: "CLIENT_CREATED",
    targetType: "CLIENT",
    targetId: client.id,
    targetLabel: client.name,
    detail: { type },
  })

  return ok({ client }, 201)
}

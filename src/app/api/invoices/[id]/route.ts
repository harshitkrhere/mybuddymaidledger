import { db } from "@/lib/db"
import { audit } from "@/lib/auth"
import { fail, ok, readJson, requireModule, requireRole } from "@/lib/api-helpers"
import { computeInvoiceTotals, validateInvoiceBody } from "@/lib/finance-validation"

// ============================================================
// /api/invoices/[id] — edit invoice, change status, delete.
// ============================================================

type PatchBody =
  | { action: "setStatus"; status: string }
  | (Parameters<typeof validateInvoiceBody>[0] & { action?: undefined })

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireModule("invoices")
  if ("response" in guard) return guard.response
  const actor = guard.user
  const { id } = await ctx.params

  const existing = await db.invoice.findUnique({ where: { id }, include: { client: true } })
  if (!existing) return fail(404, "That invoice no longer exists.")

  const body = await readJson<PatchBody>(req)

  // ---------- Status transitions (mark sent / paid / back to draft) ----------
  if (body && body.action === "setStatus") {
    const status = body.status ?? ""
    if (!["DRAFT", "SENT", "PAID"].includes(status)) return fail(400, "Unknown status.")
    if (status === existing.status) return fail(400, "The invoice already has this status.")

    await db.invoice.update({ where: { id }, data: { status } })
    await audit({
      actorId: actor.id,
      action: "INVOICE_STATUS_CHANGED",
      targetType: "INVOICE",
      targetId: id,
      targetLabel: existing.number,
      detail: { from: existing.status, to: status, total: existing.total },
    })
    return ok({ ok: true })
  }

  // ---------- Full edit (line items replaced atomically) ----------
  const error = validateInvoiceBody(body)
  if (error) return fail(400, error)

  const client = await db.client.findUnique({ where: { id: body!.clientId! } })
  if (!client) return fail(400, "That client no longer exists.")

  const taxRate = body!.taxRate ?? 18
  const { lines, subtotal, taxAmount, total } = computeInvoiceTotals(body!.items!, taxRate)

  await db.invoiceItem.deleteMany({ where: { invoiceId: id } })
  const invoice = await db.invoice.update({
    where: { id },
    data: {
      clientId: client.id,
      issueDate: new Date(body!.issueDate!),
      dueDate: body!.dueDate ? new Date(body!.dueDate) : null,
      notes: (body!.notes ?? "").trim() || null,
      taxRate,
      subtotal,
      taxAmount,
      total,
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
    action: "INVOICE_UPDATED",
    targetType: "INVOICE",
    targetId: id,
    targetLabel: invoice.number,
    detail: {
      from: { total: existing.total, client: existing.client.name },
      to: { total, client: client.name },
    },
  })

  return ok({ invoice })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("RED", "ADMIN")
  if ("response" in guard) return guard.response
  const { id } = await ctx.params

  const existing = await db.invoice.findUnique({ where: { id } })
  if (!existing) return fail(404, "That invoice no longer exists.")

  await db.invoice.delete({ where: { id } }) // items cascade
  await audit({
    actorId: guard.user.id,
    action: "INVOICE_DELETED",
    targetType: "INVOICE",
    targetId: id,
    targetLabel: existing.number,
    detail: { total: existing.total },
  })

  return ok({ ok: true })
}

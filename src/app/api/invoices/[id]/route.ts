import { db } from "@/lib/db"
import { audit } from "@/lib/auth"
import { fail, ok, readJson, requireModule, requireRole, route } from "@/lib/api-helpers"
import { computeInvoiceTotals, InvoiceSchema, InvoiceStatusSchema, parseWith } from "@/lib/validation"
import { z } from "zod"

// ============================================================
// /api/invoices/[id] — edit invoice, change status, delete.
//
// The full edit replaces line items ATOMICALLY: item deletion and
// re-creation run in the same database transaction as the invoice
// update, so a failure mid-way can never leave an invoice without
// its items (zero state drift between invoice and line items).
// ============================================================

type Ctx = { params: Promise<{ id: string }> }

const StatusPatchSchema = z.object({ action: z.literal("setStatus"), status: InvoiceStatusSchema })

export const PATCH = route<Ctx>("invoices.update", async (req, ctx) => {
  const guard = await requireModule("invoices")
  if ("response" in guard) return guard.response
  const actor = guard.user
  const { id } = await ctx.params

  const existing = await db.invoice.findUnique({ where: { id }, include: { client: true } })
  if (!existing) return fail(404, "That invoice no longer exists.")

  const body = await readJson(req)

  // ---------- Status transitions (mark sent / paid / back to draft) ----------
  const statusPatch = parseWith(StatusPatchSchema, body)
  if (statusPatch.ok) {
    const status = statusPatch.value.status
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
  const parsed = parseWith(InvoiceSchema, body)
  if (!parsed.ok) {
    // Distinguish "not a status patch AND not a valid edit" from a plain bad payload:
    // if the body carried an unknown action, say so explicitly.
    if (body && "action" in (body as Record<string, unknown>)) return fail(400, "Unsupported action.")
    return fail(400, parsed.error)
  }
  const edit = parsed.value

  const client = await db.client.findUnique({ where: { id: edit.clientId } })
  if (!client) return fail(400, "That client no longer exists.")

  const { lines, subtotal, taxAmount, total } = computeInvoiceTotals(edit.items, edit.taxRate)

  const invoice = await db.$transaction(async (tx) => {
    await tx.invoiceItem.deleteMany({ where: { invoiceId: id } })
    return tx.invoice.update({
      where: { id },
      data: {
        clientId: client.id,
        issueDate: new Date(edit.issueDate),
        dueDate: edit.dueDate ? new Date(edit.dueDate) : null,
        notes: edit.notes,
        taxRate: edit.taxRate,
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
})

export const DELETE = route<Ctx>("invoices.delete", async (_req, ctx) => {
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
})

import { db } from "@/lib/db"
import { audit } from "@/lib/auth"
import { fail, ok, readJson, requireUser, route } from "@/lib/api-helpers"
import { canApproveExpenses, canDeleteRecords } from "@/lib/permissions"
import { ExpensePatchSchema, ExpenseReviewSchema, parseWith } from "@/lib/validation"

// ============================================================
// /api/expenses/[id] — review (approve/reject), edit, delete.
// Nobody reviews their own submission. Owners may edit or
// withdraw while still PENDING. Red/Admin may delete anything.
// The review write is guarded against double-review races by a
// status predicate inside the UPDATE itself.
// ============================================================

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = route<Ctx>("expenses.update", async (req, ctx) => {
  const guard = await requireUser()
  if ("response" in guard) return guard.response
  const user = guard.user
  const { id } = await ctx.params

  const existing = await db.expense.findUnique({
    where: { id },
    include: { submitter: { select: { id: true, name: true, email: true } } },
  })
  if (!existing) return fail(404, "That expense no longer exists.")

  const body = await readJson(req)

  // ---------- Approve / reject ----------
  const review = parseWith(ExpenseReviewSchema, body)
  if (review.ok) {
    if (!canApproveExpenses(user.role)) {
      return fail(403, "You do not have permission to review expenses.")
    }
    if (existing.submittedById === user.id) {
      return fail(403, "You cannot review your own submission.")
    }
    if (existing.status !== "PENDING") return fail(400, "This expense has already been reviewed.")

    // Conditional update — if another reviewer wins the race between our
    // read and write, zero rows match and we report the conflict honestly.
    const result = await db.expense.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status: review.value.status,
        reviewedById: user.id,
        reviewNote: review.value.note,
        reviewedAt: new Date(),
      },
    })
    if (result.count === 0) return fail(409, "This expense was just reviewed by someone else — refreshing.")

    await audit({
      actorId: user.id,
      action: review.value.status === "APPROVED" ? "EXPENSE_APPROVED" : "EXPENSE_REJECTED",
      targetType: "EXPENSE",
      targetId: id,
      targetLabel: existing.description,
      detail: {
        submitter: existing.submitter.email,
        amount: existing.amount,
        note: review.value.note,
      },
    })
    return ok({ ok: true })
  }

  // ---------- Owner edit (only while pending) ----------
  const isOwner = existing.submittedById === user.id
  if (!isOwner) return fail(403, "Only the submitter can edit this expense.")
  if (existing.status !== "PENDING") return fail(400, "Reviewed expenses can no longer be edited.")

  const patch = parseWith(ExpensePatchSchema, body)
  if (!patch.ok) return fail(400, patch.error)
  const b = patch.value

  if (b.categoryId && !(await db.category.findUnique({ where: { id: b.categoryId } }))) {
    return fail(400, "That category no longer exists.")
  }

  const expense = await db.expense.update({
    where: { id },
    data: {
      ...(b.date ? { date: new Date(b.date) } : {}),
      ...(b.amount !== undefined ? { amount: b.amount } : {}),
      ...(b.description !== undefined ? { description: b.description } : {}),
      ...(b.categoryId !== undefined ? { categoryId: b.categoryId || null } : {}),
      ...(b.receiptRef !== undefined ? { receiptRef: b.receiptRef } : {}),
    },
    include: {
      category: true,
      submitter: { select: { id: true, name: true, role: true } },
      reviewer: { select: { id: true, name: true } },
    },
  })

  await audit({
    actorId: user.id,
    action: "EXPENSE_UPDATED",
    targetType: "EXPENSE",
    targetId: id,
    targetLabel: expense.description,
    detail: { from: { amount: existing.amount }, to: { amount: expense.amount } },
  })

  return ok({ expense })
})

export const DELETE = route<Ctx>("expenses.delete", async (_req, ctx) => {
  const guard = await requireUser()
  if ("response" in guard) return guard.response
  const user = guard.user
  const { id } = await ctx.params

  const existing = await db.expense.findUnique({ where: { id } })
  if (!existing) return fail(404, "That expense no longer exists.")

  const isOwner = existing.submittedById === user.id
  const mayDelete = (isOwner && existing.status === "PENDING") || canDeleteRecords(user.role)
  if (!mayDelete) return fail(403, "You do not have permission to delete this expense.")

  await db.expense.delete({ where: { id } })
  await audit({
    actorId: user.id,
    action: "EXPENSE_DELETED",
    targetType: "EXPENSE",
    targetId: id,
    targetLabel: existing.description,
    detail: { amount: existing.amount },
  })

  return ok({ ok: true })
})

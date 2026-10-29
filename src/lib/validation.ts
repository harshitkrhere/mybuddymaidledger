import "server-only"
import { z } from "zod"

// ============================================================
// Request validation — every mutating endpoint parses its payload
// through a Zod schema BEFORE touching the database. Prisma then
// parameterises all queries, so SQL injection is structurally
// impossible: payloads are coerced, length-capped and shape-checked,
// and no string is ever interpolated into SQL.
//
// Error style: the FIRST field issue is surfaced as one friendly,
// non-technical message (Apple-tone copy, identical to the UI hints),
// so the client never sees a raw Zod dump or an internal detail.
// ============================================================

// ---------------- shared primitives ----------------

const money = z
  .number({ message: "Please enter a valid amount." })
  .finite()
  .positive({ message: "Amount must be greater than zero." })
  .max(9_999_999_999, { message: "That amount is too large." })

const optionalMoney = z
  .number({ message: "Please enter a valid amount." })
  .finite()
  .positive({ message: "Amount must be greater than zero." })
  .max(9_999_999_999, { message: "That amount is too large." })
  .optional()

const isoDate = z
  .string({ message: "Please pick a valid date." })
  .refine((v) => !isNaN(Date.parse(v)), { message: "Please pick a valid date." })

const trimmed = (max = 200, label = "this field") =>
  z
    .string({ message: `Please fill in ${label}.` })
    .trim()
    .min(1, { message: `Please fill in ${label}.` })
    .max(max, { message: `${label.charAt(0).toUpperCase() + label.slice(1)} is too long (max ${max} characters).` })

const nullableTrimmed = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, { message: `Too long (max ${max} characters).` })
    .transform((v) => (v === "" ? null : v))
    .nullish()
    .transform((v) => v ?? null)

const cuid = z.string().regex(/^[a-zA-Z0-9_-]{6,64}$/, { message: "That selection is no longer valid." })

const nullableId = z
  .union([cuid, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : (v as string | null)))

// ---------------- auth ----------------

export const LoginSchema = z.object({
  email: z
    .string({ message: "Please enter your email and password." })
    .trim()
    .toLowerCase()
    .min(1, { message: "Please enter your email and password." })
    .max(200)
    .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: "That email address doesn't look right." }),
  password: z
    .string({ message: "Please enter your email and password." })
    .min(1, { message: "Please enter your email and password." })
    .max(200),
})

// ---------------- transactions ----------------

export const TransactionSchema = z.object({
  date: isoDate,
  type: z.enum(["INCOME", "EXPENSE"], { message: "Type must be income or expense." }),
  amount: money,
  description: trimmed(300, "a description"),
  categoryId: nullableId,
  clientId: nullableId,
  reference: nullableTrimmed(120),
  paymentMethod: z.enum(["UPI", "BANK", "CARD", "CASH"], { message: "Unknown payment method." }).default("BANK"),
})

export type TransactionInput = z.infer<typeof TransactionSchema>

// ---------------- invoices ----------------

const InvoiceItemSchema = z.object({
  description: trimmed(300, "a description"),
  quantity: z
    .number({ message: "Line item quantities must be greater than zero." })
    .finite()
    .positive({ message: "Line item quantities must be greater than zero." })
    .max(1_000_000, { message: "Line item quantities must be greater than zero." }),
  unitPrice: z
    .number({ message: "Line item prices must be zero or more." })
    .finite()
    .min(0, { message: "Line item prices must be zero or more." })
    .max(9_999_999_999, { message: "Line item prices are too large." }),
})

export const InvoiceSchema = z
  .object({
    clientId: cuid,
    issueDate: isoDate,
    dueDate: isoDate.nullish().transform((v) => (v ? v : null)),
    notes: nullableTrimmed(1000),
    taxRate: z
      .number({ message: "Tax rate must be between 0 and 100." })
      .finite()
      .min(0, { message: "Tax rate must be between 0 and 100." })
      .max(100, { message: "Tax rate must be between 0 and 100." })
      .default(18),
    items: z
      .array(InvoiceItemSchema, { message: "An invoice needs at least one line item." })
      .min(1, { message: "An invoice needs at least one line item." })
      .max(100, { message: "An invoice can hold at most 100 line items." }),
  })
  .refine((v) => !v.dueDate || Date.parse(v.dueDate) >= Date.parse(v.issueDate), {
    message: "The due date can't be before the issue date.",
    path: ["dueDate"],
  })

export type InvoiceInput = z.infer<typeof InvoiceSchema>

export const InvoiceStatusSchema = z.enum(["DRAFT", "SENT", "PAID"], { message: "Unknown status." })

/** Server-computed money math — clients never dictate totals. */
export function computeInvoiceTotals(items: { description: string; quantity: number; unitPrice: number }[], taxRate: number) {
  const lines = items.map((item) => ({
    description: item.description.trim(),
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    amount: Math.round(item.quantity * item.unitPrice * 100) / 100,
  }))
  const subtotal = Math.round(lines.reduce((sum, l) => sum + l.amount, 0) * 100) / 100
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100
  const total = Math.round((subtotal + taxAmount) * 100) / 100
  return { lines, subtotal, taxAmount, total }
}

// ---------------- expenses ----------------

export const ExpenseSchema = z.object({
  date: isoDate,
  amount: money,
  description: trimmed(300, "a description"),
  categoryId: nullableId,
  receiptRef: nullableTrimmed(120),
})

export const ExpensePatchSchema = z
  .object({
    date: isoDate.optional(),
    amount: optionalMoney,
    description: z.string().trim().min(1, { message: "Please describe the expense." }).max(300).optional(),
    categoryId: z.union([cuid, z.literal(""), z.null()]).optional(),
    receiptRef: z.string().trim().max(120).nullish().transform((v) => (v === "" || v === undefined ? null : v)).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update." })

export const ExpenseReviewSchema = z.object({
  action: z.literal("review", { message: "Unsupported action." }),
  status: z.enum(["APPROVED", "REJECTED"], { message: "Unknown review status." }),
  note: z.string().trim().max(500).nullish().transform((v) => (v && v !== "" ? v : null)),
})

// ---------------- clients ----------------

export const ClientSchema = z.object({
  name: trimmed(160, "a name"),
  type: z.enum(["CLIENT", "VENDOR"], { message: "Type must be client or vendor." }).default("CLIENT"),
  email: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: "That email address doesn't look right." })
    .nullish()
    .transform((v) => (v === "" || v === undefined ? null : (v as string | null))),
  phone: nullableTrimmed(60),
  address: nullableTrimmed(400),
  notes: nullableTrimmed(1000),
})

export const ClientPatchSchema = z
  .object({
    name: z.string().trim().min(1, { message: "Name cannot be empty." }).max(160).optional(),
    type: z.enum(["CLIENT", "VENDOR"], { message: "Type must be client or vendor." }).optional(),
    email: z
      .string()
      .trim()
      .max(200)
      .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: "That email address doesn't look right." })
      .optional(),
    phone: z.string().trim().max(60).optional(),
    address: z.string().trim().max(400).optional(),
    notes: z.string().trim().max(1000).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update." })

// ---------------- team & users ----------------

export const CreateUserSchema = z.object({
  name: trimmed(120, "a name"),
  email: z
    .string({ message: "That email address doesn't look right." })
    .trim()
    .toLowerCase()
    .max(200)
    .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: "That email address doesn't look right." }),
  password: z
    .string({ message: "Passwords must be at least 8 characters." })
    .min(8, { message: "Passwords must be at least 8 characters." })
    .max(200, { message: "Passwords must be at most 200 characters." }),
  role: z.string({ message: "Please choose a role." }),
  title: z.string().trim().max(120).nullish().transform((v) => (v === "" || v === undefined ? null : v)),
})

export const UserPatchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("setRole"),
    role: z.string({ message: "Unknown role." }),
  }),
  z.object({
    action: z.literal("setStatus"),
    status: z.enum(["ACTIVE", "INACTIVE"], { message: "Unknown status." }),
  }),
  z.object({
    action: z.literal("resetPassword"),
    password: z
      .string({ message: "Passwords must be at least 8 characters." })
      .min(8, { message: "Passwords must be at least 8 characters." })
      .max(200, { message: "Passwords must be at most 200 characters." }),
  }),
  z.object({
    action: z.literal("updateProfile"),
    name: z.string().trim().min(1, { message: "Name cannot be empty." }).max(120),
    title: z.string().trim().max(120).nullish().transform((v) => (v === "" || v === undefined ? null : v)),
  }),
])

// ---------------- settings ----------------

export const SettingsSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("profile"),
    name: z.string().trim().min(1, { message: "Name cannot be empty." }).max(120),
    title: z.string().trim().max(120).nullish().transform((v) => (v === "" || v === undefined ? null : v)),
  }),
  z.object({
    action: z.literal("password"),
    currentPassword: z.string({ message: "Your current password is incorrect." }).min(1, {
      message: "Your current password is incorrect.",
    }),
    newPassword: z
      .string({ message: "New passwords must be at least 8 characters." })
      .min(8, { message: "New passwords must be at least 8 characters." })
      .max(200, { message: "Passwords must be at most 200 characters." }),
  }),
  z.object({
    action: z.literal("company"),
    companyName: z.string().trim().min(1).max(160).optional(),
    currency: z.enum(["INR", "USD", "EUR", "GBP", "AED", "SGD"]).optional(),
    taxRate: z
      .number({ message: "Tax rate must be between 0 and 100." })
      .finite()
      .min(0, { message: "Tax rate must be between 0 and 100." })
      .max(100, { message: "Tax rate must be between 0 and 100." })
      .optional(),
    email: z.string().trim().max(200).optional(),
    phone: z.string().trim().max(60).optional(),
    address: z.string().trim().max(400).optional(),
  }),
])

// ---------------- reports ----------------

export const ReportQuerySchema = z
  .object({
    from: isoDate.optional(),
    to: isoDate.optional(),
  })
  .refine((v) => !v.from || !v.to || Date.parse(v.to) >= Date.parse(v.from), {
    message: "The end date can't be before the start date.",
  })

// ============================================================
// parse helpers — the single way routes turn payloads into data
// ============================================================

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

/** Returns the first human-friendly issue, or the parsed value. */
export function parseWith<S extends z.ZodType>(schema: S, body: unknown): ParseResult<z.output<S>> {
  if (body === null || body === undefined) {
    return { ok: false, error: "Missing request details." }
  }
  const result = schema.safeParse(body)
  if (result.success) return { ok: true, value: result.data }
  const issue = result.error.issues[0]
  return { ok: false, error: issue?.message ?? "Please check the highlighted fields." }
}

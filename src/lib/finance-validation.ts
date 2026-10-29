import "server-only"

export type TxBody = {
  date?: string
  type?: string
  amount?: number
  description?: string
  categoryId?: string | null
  clientId?: string | null
  reference?: string | null
  paymentMethod?: string
}

export function validateTxBody(body: TxBody | null): string | null {
  if (!body) return "Missing transaction details."
  if (!body.date || isNaN(Date.parse(body.date))) return "Please pick a valid date."
  if (body.type !== "INCOME" && body.type !== "EXPENSE") return "Type must be income or expense."
  if (!body.amount || body.amount <= 0) return "Amount must be greater than zero."
  if (!(body.description ?? "").trim()) return "Please add a description."
  if (!["UPI", "BANK", "CARD", "CASH"].includes(body.paymentMethod ?? "BANK")) return "Unknown payment method."
  return null
}

export type InvoiceItemBody = {
  description?: string
  quantity?: number
  unitPrice?: number
}

export type InvoiceBody = {
  clientId?: string
  issueDate?: string
  dueDate?: string | null
  notes?: string | null
  taxRate?: number
  items?: InvoiceItemBody[]
}

export function validateInvoiceBody(body: InvoiceBody | null): string | null {
  if (!body) return "Missing invoice details."
  if (!body.clientId) return "Please choose a client."
  if (!body.issueDate || isNaN(Date.parse(body.issueDate))) return "Please pick a valid issue date."
  if (body.dueDate && isNaN(Date.parse(body.dueDate))) return "Please pick a valid due date."
  if (!body.items || body.items.length === 0) return "An invoice needs at least one line item."
  for (const item of body.items) {
    if (!(item.description ?? "").trim()) return "Every line item needs a description."
    if (!item.quantity || item.quantity <= 0) return "Line item quantities must be greater than zero."
    if (item.unitPrice === undefined || item.unitPrice === null || item.unitPrice < 0) {
      return "Line item prices must be zero or more."
    }
  }
  if (body.taxRate === undefined || body.taxRate < 0 || body.taxRate > 100) {
    return "Tax rate must be between 0 and 100."
  }
  return null
}

export function computeInvoiceTotals(items: InvoiceItemBody[], taxRate: number) {
  const lines = items.map((item) => ({
    description: item.description!.trim(),
    quantity: item.quantity!,
    unitPrice: item.unitPrice!,
    amount: Math.round(item.quantity! * item.unitPrice! * 100) / 100,
  }))
  const subtotal = Math.round(lines.reduce((sum, l) => sum + l.amount, 0) * 100) / 100
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100
  const total = Math.round((subtotal + taxAmount) * 100) / 100
  return { lines, subtotal, taxAmount, total }
}

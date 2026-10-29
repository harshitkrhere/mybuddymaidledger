// ============================================================
// Seed — Ledger portal bootstrap.
// Creates one user per role, categories, clients, and a year of
// realistic finance data so the dashboard feels alive on day one.
// Run: bun run db:seed
//
// SECURITY: account passwords are NEVER hardcoded here. They are
// read from the SEED_PASSWORD_* environment variables (set them in
// .env — which is gitignored — or as platform secrets). Seeding
// fails fast if any of them is missing.
// ============================================================

import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const db = new PrismaClient()

// Small deterministic PRNG so repeated seeds look consistent.
let seed = 42
function rnd() {
  seed = (seed * 1103515245 + 12345) % 2147483648
  return seed / 2147483648
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)]
}
function between(min: number, max: number) {
  return Math.round(min + rnd() * (max - min))
}

// Required, env-provided credentials — no defaults, no fallbacks.
function requiredSeedPassword(name: string): string {
  const value = process.env[`SEED_PASSWORD_${name.toUpperCase()}`]
  if (!value || value.length < 8) {
    throw new Error(
      `Missing or too-short SEED_PASSWORD_${name.toUpperCase()} — set it in .env (gitignored) ` +
        `or as a platform secret, then re-run db:seed. Minimum length: 8 characters.`,
    )
  }
  return value
}

const PASSWORDS: Record<string, string> = {
  red: requiredSeedPassword("red"),
  admin: requiredSeedPassword("admin"),
  manager: requiredSeedPassword("manager"),
  employee: requiredSeedPassword("employee"),
}

async function main() {
  console.log("Clearing existing data…")
  await db.session.deleteMany()
  await db.auditLog.deleteMany()
  await db.invoiceItem.deleteMany()
  await db.invoice.deleteMany()
  await db.expense.deleteMany()
  await db.transaction.deleteMany()
  await db.category.deleteMany()
  await db.client.deleteMany()
  await db.companySettings.deleteMany()
  await db.user.deleteMany()

  console.log("Creating users (one per role)…")
  const hash = async (p: string) => bcrypt.hash(p, 10)

  const red = await db.user.create({
    data: {
      name: "Aarav Mehta",
      email: "red@mybuddymaid.com",
      passwordHash: await hash(PASSWORDS.red),
      role: "RED",
      title: "Founder & Owner",
    },
  })
  const admin = await db.user.create({
    data: {
      name: "Sneha Iyer",
      email: "admin@mybuddymaid.com",
      passwordHash: await hash(PASSWORDS.admin),
      role: "ADMIN",
      title: "Operations Admin",
    },
  })
  const manager = await db.user.create({
    data: {
      name: "Rohit Sharma",
      email: "manager@mybuddymaid.com",
      passwordHash: await hash(PASSWORDS.manager),
      role: "MANAGER",
      title: "Finance Manager",
    },
  })
  const employee = await db.user.create({
    data: {
      name: "Priya Nair",
      email: "employee@mybuddymaid.com",
      passwordHash: await hash(PASSWORDS.employee),
      role: "EMPLOYEE",
      title: "Field Coordinator",
    },
  })
  const employee2 = await db.user.create({
    data: {
      name: "Kabir Singh",
      email: "kabir@mybuddymaid.com",
      passwordHash: await hash(PASSWORDS.employee),
      role: "EMPLOYEE",
      title: "Recruitment Associate",
    },
  })

  console.log("Creating company settings…")
  await db.companySettings.create({
    data: {
      id: "singleton",
      companyName: "MyBuddyMaid Services",
      currency: "INR",
      taxRate: 18,
      email: "billing@mybuddymaid.com",
      phone: "+91 98200 12345",
      address: "4th Floor, Trade Centre, Bandra Kurla Complex, Mumbai 400051",
    },
  })

  console.log("Creating categories…")
  const incomeCats = await Promise.all(
    ["Plan Sales", "Placement Fees", "Renewals", "Consulting"].map((name) =>
      db.category.create({ data: { name, type: "INCOME" } })
    )
  )
  const expenseCats = await Promise.all(
    [
      "Salaries & Wages",
      "Helper Recruitment",
      "Transport & Logistics",
      "Marketing",
      "Office Rent",
      "Utilities",
      "Software & Tools",
      "Training & Verification",
    ].map((name) => db.category.create({ data: { name, type: "EXPENSE" } }))
  )

  console.log("Creating clients & vendors…")
  const clientNames = [
    ["Sharma Family", "suresh.sharma@example.com", "Bandra West, Mumbai"],
    ["Kapoor Household", "ritika.kapoor@example.com", "Juhu, Mumbai"],
    ["Mehta Residence", "jay.mehta@example.com", "Powai, Mumbai"],
    ["Reddy Villa", "lakshmi.reddy@example.com", "Banjara Hills, Hyderabad"],
    ["Iyer Home", "ram.iyer@example.com", "Adyar, Chennai"],
    ["Gupta Family", "neha.gupta@example.com", "Indiranagar, Bengaluru"],
  ]
  const clients = await Promise.all(
    clientNames.map(([name, email, address]) =>
      db.client.create({ data: { name, email, address, phone: `+91 9${between(100000000, 999999999)}`, type: "CLIENT" } })
    )
  )
  const vendors = await Promise.all(
    [
      ["CleanPro Supplies", "accounts@cleanpro.example.com", "VENDOR"],
      ["SecureCheck Verification", "billing@securecheck.example.com", "VENDOR"],
      ["QuickMove Logistics", "ops@quickmove.example.com", "VENDOR"],
    ].map(([name, email, type]) =>
      db.client.create({ data: { name, email, type, address: "Andheri East, Mumbai" } })
    )
  )

  // ------------------------------------------------------------
  // Transactions — 14 months of ledger history
  // ------------------------------------------------------------
  console.log("Creating transactions…")
  const today = new Date()
  const txCreators = [manager.id, admin.id, red.id]
  let txCount = 0

  for (let m = 13; m >= 0; m--) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - m, 1)
    const growth = 1 + (13 - m) * 0.045 // gentle upward trend

    // Income: 8–12 entries per month (healthy, growing top line)
    const incomeEntries = between(8, 12)
    for (let i = 0; i < incomeEntries; i++) {
      const day = between(1, 28)
      const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day)
      if (date > today) continue
      const cat = pick(incomeCats)
      const base = cat.name === "Plan Sales" ? between(18000, 48000) : cat.name === "Placement Fees" ? between(8000, 22000) : between(4000, 15000)
      txCount++
      await db.transaction.create({
        data: {
          date,
          type: "INCOME",
          amount: Math.round(base * growth),
          description:
            cat.name === "Plan Sales"
              ? `${pick(["Silver", "Gold", "Diamond"])} plan sale — ${pick(clients).name}`
              : cat.name === "Placement Fees"
                ? `Placement fee — ${pick(["maid", "cook", "babysitter", "elder care"])} · ${pick(clients).name}`
                : cat.name === "Renewals"
                  ? `Plan renewal — ${pick(clients).name}`
                  : `Consulting — household staffing advisory`,
          categoryId: cat.id,
          clientId: rnd() > 0.25 ? pick(clients).id : null,
          paymentMethod: pick(["UPI", "BANK", "CARD", "CASH"]),
          reference: `RC-${1000 + txCount}`,
          createdById: pick(txCreators),
        },
      })
    }

    // Expenses: fixed monthly costs (rent + salaries) plus 3–5 variable entries
    const fixed: { cat: number; amount: number; desc: string }[] = [
      { cat: 4, amount: 45000, desc: `Office rent — ${monthDate.toLocaleString("en-US", { month: "long" })}` },
      { cat: 0, amount: between(38000, 52000), desc: `Staff salaries — ${monthDate.toLocaleString("en-US", { month: "long" })}` },
    ]
    const variableEntries = between(3, 5)
    for (let i = 0; i < fixed.length + variableEntries; i++) {
      const day = between(1, 28)
      const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day)
      if (date > today) continue
      const isFixed = i < fixed.length
      const cat = isFixed ? expenseCats[fixed[i].cat] : pick(expenseCats.filter((_, ci) => ci !== 0 && ci !== 4))
      const base = isFixed
        ? fixed[i].amount
        : cat.name === "Helper Recruitment"
          ? between(4000, 14000)
          : cat.name === "Marketing"
            ? between(5000, 18000)
            : cat.name === "Transport & Logistics"
              ? between(1500, 7000)
              : cat.name === "Software & Tools"
                ? between(1200, 6000)
                : cat.name === "Training & Verification"
                  ? between(2000, 9000)
                  : between(1500, 8000)
      txCount++
      await db.transaction.create({
        data: {
          date,
          type: "EXPENSE",
          amount: Math.round((isFixed ? base : base * growth) / 10) * 10,
          description: isFixed
            ? fixed[i].desc
            : cat.name === "Helper Recruitment"
              ? `Recruitment drive — ${pick(["Nashik", "Solapur", "Nagpur", "Kolhapur"])}`
              : cat.name === "Marketing"
                ? pick(["Google Ads — local", "Instagram campaign", "Print flyers — society noticeboards", "Radio spot — local FM"])
                : cat.name === "Transport & Logistics"
                  ? pick(["Helper travel reimbursement", "Fuel — client visits", "Cab — airport pickup for helper"])
                  : cat.name === "Software & Tools"
                    ? pick(["CRM subscription", "Accounting software", "Phone + broadband bill"])
                    : cat.name === "Training & Verification"
                      ? pick(["Police verification batch", "Skill training workshop", "Background checks"])
                      : pick(["Electricity bill", "Water bill", "Office supplies"]),
          categoryId: cat.id,
          clientId: rnd() > 0.6 ? pick(vendors).id : null,
          paymentMethod: pick(["BANK", "UPI", "CASH"]),
          reference: `RC-${2000 + txCount}`,
          createdById: pick(txCreators),
        },
      })
    }
  }

  // ------------------------------------------------------------
  // Invoices — mixed statuses
  // ------------------------------------------------------------
  console.log("Creating invoices…")
  let invSeq = 0
  async function makeInvoice(clientIdx: number, monthsAgo: number, status: string, lines: { d: string; q: number; p: number }[]) {
    invSeq++
    const year = new Date(today.getFullYear(), today.getMonth() - monthsAgo, 1).getFullYear()
    const issue = new Date(today.getFullYear(), today.getMonth() - monthsAgo, between(2, 20))
    if (issue > today) issue.setDate(today.getDate() - 5)
    const due = new Date(issue)
    due.setDate(due.getDate() + 15)
    const taxRate = 18
    const items = lines.map((l) => ({ description: l.d, quantity: l.q, unitPrice: l.p, amount: l.q * l.p }))
    const subtotal = items.reduce((s, i) => s + i.amount, 0)
    const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100
    const total = subtotal + taxAmount
    await db.invoice.create({
      data: {
        number: `INV-${year}-${String(invSeq).padStart(4, "0")}`,
        clientId: clients[clientIdx].id,
        issueDate: issue,
        dueDate: due,
        status,
        subtotal,
        taxRate,
        taxAmount,
        total,
        notes: status === "SENT" ? "Payment due within 15 days. UPI: mybuddymaid@okicici" : null,
        createdById: manager.id,
        items: { create: items },
      },
    })
  }

  await makeInvoice(0, 4, "PAID", [{ d: "Gold plan · 12 months", q: 1, p: 36000 }, { d: "Replacement placement", q: 1, p: 6000 }])
  await makeInvoice(1, 3, "PAID", [{ d: "Silver plan · 12 months", q: 1, p: 18000 }])
  await makeInvoice(2, 3, "PAID", [{ d: "Diamond plan · 12 months", q: 1, p: 54000 }, { d: "Dedicated coordinator", q: 3, p: 2500 }])
  await makeInvoice(3, 2, "PAID", [{ d: "Gold plan · 12 months", q: 1, p: 36000 }])
  await makeInvoice(0, 1, "SENT", [{ d: "Renewal · Gold plan", q: 1, p: 36000 }])
  await makeInvoice(4, 1, "SENT", [{ d: "Placement fee — full-time cook", q: 1, p: 14000 }])
  await makeInvoice(5, 0, "SENT", [{ d: "Diamond plan · 12 months", q: 1, p: 54000 }])
  await makeInvoice(1, 0, "OVERDUE_SENT" as string, [{ d: "Replacement placement ×2", q: 2, p: 6000 }])
  await makeInvoice(2, 0, "DRAFT", [{ d: "Consulting — staffing audit", q: 1, p: 20000 }])
  await makeInvoice(3, 0, "DRAFT", [{ d: "Silver plan renewal", q: 1, p: 18000 }])

  // The OVERDUE_SENT placeholder: normalize to SENT with an old due date.
  await db.invoice.updateMany({ where: { status: "OVERDUE_SENT" }, data: { status: "SENT" } })
  const overdue = await db.invoice.findFirst({ where: { number: { endsWith: "0008" } } })
  if (overdue) {
    await db.invoice.update({
      where: { id: overdue.id },
      data: { dueDate: new Date(today.getTime() - 21 * 86400000) },
    })
  }

  // ------------------------------------------------------------
  // Expenses — submissions across the team
  // ------------------------------------------------------------
  console.log("Creating expenses…")
  const expenseSpecs: { user: string; daysAgo: number; amount: number; cat: number; desc: string; status: string; receipt?: string; note?: string }[] = [
    { user: employee.id, daysAgo: 2, amount: 1450, cat: 2, desc: "Cab — helper airport pickup", status: "PENDING", receipt: "RCPT-1041" },
    { user: employee.id, daysAgo: 4, amount: 3200, cat: 3, desc: "Flyers — society noticeboards, Powai", status: "PENDING", receipt: "RCPT-1038" },
    { user: employee2.id, daysAgo: 3, amount: 5600, cat: 7, desc: "Police verification — 4 helpers, Nashik batch", status: "PENDING", receipt: "RCPT-1044" },
    { user: employee2.id, daysAgo: 1, amount: 890, cat: 2, desc: "Fuel — client visits, Bandra to Andheri", status: "PENDING" },
    { user: manager.id, daysAgo: 6, amount: 4200, cat: 6, desc: "Accounting software — annual renewal", status: "PENDING", receipt: "RCPT-1029" },
    { user: employee.id, daysAgo: 12, amount: 2100, cat: 2, desc: "Cab — two client visits, Juhu", status: "APPROVED", note: "Approved within travel budget." },
    { user: employee.id, daysAgo: 20, amount: 750, cat: 4, desc: "Team chai + snacks — Friday wrap-up", status: "APPROVED", note: "Approved. Keep these modest, please." },
    { user: employee2.id, daysAgo: 15, amount: 3400, cat: 7, desc: "Training workshop — safety protocols", status: "APPROVED", note: "Good use of the training budget." },
    { user: employee2.id, daysAgo: 25, amount: 1800, cat: 3, desc: "Poster print — recruitment drive", status: "REJECTED", note: "Duplicate of the marketing batch — declined." },
    { user: manager.id, daysAgo: 9, amount: 5400, cat: 5, desc: "Office utility deposit", status: "APPROVED", note: "Approved — one-time." },
    { user: employee.id, daysAgo: 33, amount: 1200, cat: 6, desc: "Broadband bill — field laptop", status: "APPROVED" },
    { user: employee2.id, daysAgo: 41, amount: 2600, cat: 2, desc: "Helper transport — Solapur to Mumbai", status: "APPROVED", note: "Approved. Attach boarding passes next time." },
  ]

  for (const e of expenseSpecs) {
    const date = new Date(today.getTime() - e.daysAgo * 86400000)
    await db.expense.create({
      data: {
        submittedById: e.user,
        date,
        amount: e.amount,
        categoryId: expenseCats[e.cat].id,
        description: e.desc,
        receiptRef: e.receipt ?? null,
        status: e.status,
        ...(e.status !== "PENDING"
          ? {
              reviewedById: manager.id,
              reviewNote: e.note ?? null,
              reviewedAt: new Date(date.getTime() + 2 * 86400000),
            }
          : {}),
      },
    })
  }

  // ------------------------------------------------------------
  // Audit trail bootstrap
  // ------------------------------------------------------------
  console.log("Writing audit entries…")
  await db.auditLog.create({
    data: {
      actorId: red.id,
      action: "SYSTEM_SEEDED",
      targetType: "SETTINGS",
      targetLabel: "Ledger",
      detail: JSON.stringify({ note: "Portal initialized with demo data", users: 5 }),
    },
  })
  await db.auditLog.create({
    data: {
      actorId: red.id,
      action: "USER_CREATED",
      targetType: "USER",
      targetId: admin.id,
      targetLabel: admin.email,
      detail: JSON.stringify({ role: "ADMIN", name: admin.name }),
    },
  })
  await db.auditLog.create({
    data: {
      actorId: red.id,
      action: "USER_CREATED",
      targetType: "USER",
      targetId: manager.id,
      targetLabel: manager.email,
      detail: JSON.stringify({ role: "MANAGER", name: manager.name }),
    },
  })

  const counts = {
    users: await db.user.count(),
    transactions: await db.transaction.count(),
    invoices: await db.invoice.count(),
    expenses: await db.expense.count(),
    clients: await db.client.count(),
    categories: await db.category.count(),
  }
  console.log("Seed complete:", counts)
  // Never echo the passwords themselves — just confirm where they came from.
  console.log("\nSeeded accounts (passwords taken from SEED_PASSWORD_* env vars, never printed):")
  console.log("  Red      red@mybuddymaid.com")
  console.log("  Admin    admin@mybuddymaid.com")
  console.log("  Manager  manager@mybuddymaid.com")
  console.log("  Employee employee@mybuddymaid.com")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())

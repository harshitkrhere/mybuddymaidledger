import { db } from "@/lib/db"
import { ok, requireUser, route } from "@/lib/api-helpers"
import { canManageFinance, canManageUsers } from "@/lib/permissions"

// ============================================================
// /api/search — Universal Global Spotlight search across all modules.
// Results are strictly filtered by caller role capabilities.
// ============================================================

export const GET = route("search.global", async (req) => {
  const guard = await requireUser()
  if ("response" in guard) return guard.response
  const user = guard.user

  const url = new URL(req.url)
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100)

  const isFinance = canManageFinance(user.role)
  const isUserAdmin = canManageUsers(user.role)
  const isEmployee = user.role === "EMPLOYEE"

  // Quick navigation actions available to this user
  const allActions = [
    { id: "act-dash", title: "Go to Dashboard", subtitle: "Workspace overview and KPIs", view: "dashboard", icon: "LayoutDashboard" },
    { id: "act-new-exp", title: "New Expense Claim", subtitle: "Submit a reimbursement request", view: "expenses", action: "new", icon: "Wallet" },
    ...(isFinance
      ? [
          { id: "act-new-tx", title: "New Transaction", subtitle: "Record income or expense in ledger", view: "transactions", action: "new", icon: "ArrowLeftRight" },
          { id: "act-new-inv", title: "New Invoice", subtitle: "Create and issue client invoice", view: "invoices", action: "new", icon: "FileText" },
          { id: "act-new-client", title: "New Client or Vendor", subtitle: "Add business contact", view: "clients", action: "new", icon: "Users" },
          { id: "act-reports", title: "View Financial Reports", subtitle: "P&L statement, monthly series, CSV export", view: "reports", icon: "BarChart3" },
        ]
      : []),
    ...(isUserAdmin
      ? [
          { id: "act-team", title: "Manage Team & Roles", subtitle: "Invite users and configure access", view: "team", icon: "UserCog" },
          { id: "act-audit", title: "Audit Trail", subtitle: "Review chronological activity logs", view: "audit", icon: "ScrollText" },
        ]
      : []),
    { id: "act-settings", title: "Profile & Company Settings", subtitle: "Manage account and security", view: "settings", icon: "Settings" },
  ]

  // Filter actions if query is present
  const matchingActions = q
    ? allActions.filter(
        (a) =>
          a.title.toLowerCase().includes(q.toLowerCase()) ||
          a.subtitle.toLowerCase().includes(q.toLowerCase())
      )
    : allActions.slice(0, 4)

  if (!q) {
    return ok({
      query: "",
      results: {
        actions: matchingActions,
        transactions: [],
        invoices: [],
        expenses: [],
        clients: [],
        team: [],
      },
      counts: { total: matchingActions.length, transactions: 0, invoices: 0, expenses: 0, clients: 0, team: 0 },
    })
  }

  const cleanNum = parseFloat(q.replace(/[₹$,\s]/g, ""))
  const hasNum = !isNaN(cleanNum) && cleanNum > 0

  // Execute federated queries in parallel
  const [transactions, invoices, expenses, clients, team] = await Promise.all([
    // 1. Transactions (Finance roles only)
    isFinance
      ? db.transaction.findMany({
          where: {
            OR: [
              { description: { contains: q, mode: "insensitive" } },
              { reference: { contains: q, mode: "insensitive" } },
              { client: { name: { contains: q, mode: "insensitive" } } },
              { category: { name: { contains: q, mode: "insensitive" } } },
              ...(hasNum ? [{ amount: { gte: cleanNum * 0.999, lte: cleanNum * 1.001 } }] : []),
            ],
          },
          take: 6,
          orderBy: { date: "desc" },
          select: {
            id: true,
            type: true,
            amount: true,
            description: true,
            reference: true,
            date: true,
            client: { select: { name: true } },
            category: { select: { name: true } },
          },
        })
      : Promise.resolve([]),

    // 2. Invoices (Finance roles only)
    isFinance
      ? db.invoice.findMany({
          where: {
            OR: [
              { number: { contains: q, mode: "insensitive" } },
              { client: { name: { contains: q, mode: "insensitive" } } },
              { client: { email: { contains: q, mode: "insensitive" } } },
              { notes: { contains: q, mode: "insensitive" } },
              { items: { some: { description: { contains: q, mode: "insensitive" } } } },
              ...(hasNum ? [{ total: { gte: cleanNum * 0.999, lte: cleanNum * 1.001 } }] : []),
            ],
          },
          take: 6,
          orderBy: { issueDate: "desc" },
          select: {
            id: true,
            number: true,
            status: true,
            total: true,
            issueDate: true,
            client: { select: { name: true } },
          },
        })
      : Promise.resolve([]),

    // 3. Expenses (all roles, scoped for employees)
    db.expense.findMany({
      where: {
        ...(isEmployee ? { submittedById: user.id } : {}),
        OR: [
          { description: { contains: q, mode: "insensitive" } },
          { receiptRef: { contains: q, mode: "insensitive" } },
          { category: { name: { contains: q, mode: "insensitive" } } },
          { submitter: { name: { contains: q, mode: "insensitive" } } },
          ...(hasNum ? [{ amount: { gte: cleanNum * 0.999, lte: cleanNum * 1.001 } }] : []),
        ],
      },
      take: 6,
      orderBy: { date: "desc" },
      select: {
        id: true,
        description: true,
        amount: true,
        status: true,
        date: true,
        category: { select: { name: true } },
        submitter: { select: { name: true } },
      },
    }),

    // 4. Clients & Vendors (Finance roles only)
    isFinance
      ? db.client.findMany({
          where: {
            isActive: true,
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
              { address: { contains: q, mode: "insensitive" } },
              { notes: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 6,
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            type: true,
            email: true,
            phone: true,
          },
        })
      : Promise.resolve([]),

    // 5. Team (Admin/Red only)
    isUserAdmin
      ? db.user.findMany({
          where: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { role: { contains: q, mode: "insensitive" } },
              { title: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 6,
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            title: true,
            status: true,
          },
        })
      : Promise.resolve([]),
  ])

  const total =
    matchingActions.length +
    transactions.length +
    invoices.length +
    expenses.length +
    clients.length +
    team.length

  return ok({
    query: q,
    results: {
      actions: matchingActions,
      transactions,
      invoices,
      expenses,
      clients,
      team,
    },
    counts: {
      total,
      actions: matchingActions.length,
      transactions: transactions.length,
      invoices: invoices.length,
      expenses: expenses.length,
      clients: clients.length,
      team: team.length,
    },
  })
})

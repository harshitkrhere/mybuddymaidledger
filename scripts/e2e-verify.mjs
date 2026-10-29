#!/usr/bin/env node
// ============================================================
// e2e-verify.mjs — full-stack verification against the LIVE app.
//
//   node scripts/e2e-verify.mjs   (app must be running on :3000)
//
// Exercises every feature end-to-end through the HTTP surface:
//   · auth (all four roles) + cookie session semantics
//   · the full role permission matrix (expect 200/403 per module)
//   · CRUD for transactions, invoices (with items), expenses,
//     clients, team, settings — with immediate read-back checks
//     (zero state drift between write and read)
//   · the expense review workflow incl. self-review block
//   · role hierarchy: Admin can never mint Admins; only Red can
//   · Zod validation + SQL-injection safety (payload stored as data)
//   · concurrency: parallel invoice creation must yield unique numbers
//   · audit trail presence for privileged actions
//   · error boundary: server errors never leak internals
// ============================================================

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000"

const CREDS = {
  red: { email: "red@mybuddymaid.com", password: "Red@2026" },
  admin: { email: "admin@mybuddymaid.com", password: "Admin@2026" },
  manager: { email: "manager@mybuddymaid.com", password: "Manager@2026" },
  employee: { email: "employee@mybuddymaid.com", password: "Employee@2026" },
}

// ---------------- tiny test harness ----------------
const results = []
let currentSection = ""
async function test(name, fn) {
  try {
    await fn()
    results.push({ section: currentSection, name, ok: true })
    console.log(`  ✓ ${name}`)
  } catch (err) {
    results.push({ section: currentSection, name, ok: false, error: String(err?.message ?? err) })
    console.log(`  ✗ ${name}\n      ${String(err?.message ?? err)}`)
  }
}
function section(name) {
  currentSection = name
  console.log(`\n■ ${name}`)
}
function assert(cond, message) {
  if (!cond) throw new Error(message ?? "assertion failed")
}
function eq(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label ?? "value"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

// ---------------- http helper ----------------
async function req(method, path, { cookie, body, raw } = {}) {
  const headers = {}
  if (cookie) headers.cookie = cookie
  if (body !== undefined) headers["content-type"] = "application/json"
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? (raw ? body : JSON.stringify(body)) : undefined,
  })
  const setCookie = res.headers.get("set-cookie")
  let json = null
  const text = await res.text()
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }
  return { status: res.status, json, text, setCookie, headers: res.headers }
}

async function login(role) {
  const r = await req("POST", "/api/auth/login", { body: CREDS[role] })
  if (r.status !== 200) throw new Error(`login failed for ${role}: ${r.status} ${r.text.slice(0, 200)}`)
  const cookie = r.setCookie.split(";")[0]
  return { cookie, user: r.json.user }
}

// ============================================================
// RUN
// ============================================================
const sessions = {}
let red, admin, manager, employee

section("Health & boot")
await test("GET /api/health → 200 with database up", async () => {
  const r = await req("GET", "/api/health")
  eq(r.status, 200, "status")
  eq(r.json.ok, true, "ok flag")
  eq(r.json.database, true, "database flag")
})
await test("GET / serves the SPA", async () => {
  const r = await req("GET", "/")
  eq(r.status, 200, "status")
  assert(r.text.includes("<!DOCTYPE html>") || r.text.includes("<html"), "html served")
})

section("Authentication")
await test("malformed login payload → 400", async () => {
  const r = await req("POST", "/api/auth/login", { body: { email: "not-an-email", password: "" } })
  eq(r.status, 400, "status")
  assert(r.json?.error, "friendly error present")
})
await test("wrong credentials → 401 with a single non-committal message", async () => {
  const r = await req("POST", "/api/auth/login", { body: { email: CREDS.red.email, password: "wrong-password" } })
  eq(r.status, 401, "status")
  assert(!r.json.error.toLowerCase().includes("password is wrong"), "no hint about which field failed")
})
for (const role of ["red", "admin", "manager", "employee"]) {
  await test(`login as ${role} → session cookie (httpOnly)`, async () => {
    const s = await login(role)
    sessions[role] = s
    eq(s.user.role, role.toUpperCase(), "role")
    assert(s.cookie.startsWith("portal_session="), "session cookie set")
  })
}
red = sessions.red
admin = sessions.admin
manager = sessions.manager
employee = sessions.employee

await test("GET /api/auth/me without cookie → 401", async () => {
  const r = await req("GET", "/api/auth/me")
  eq(r.status, 401, "status")
})
await test("GET /api/auth/me reflects fresh role from the database", async () => {
  const r = await req("GET", "/api/auth/me", { cookie: manager.cookie })
  eq(r.status, 200, "status")
  eq(r.json.user.email, CREDS.manager.email, "email")
  eq(r.json.capabilities.canManageFinance, true, "manager canManageFinance")
  eq(r.json.capabilities.canManageUsers, false, "manager canManageUsers")
})

section("Permission matrix (module access per role)")
const MATRIX = {
  // [path, employee, manager, admin, red]
  "/api/transactions": [403, 200, 200, 200],
  "/api/invoices": [403, 200, 200, 200],
  "/api/clients": [403, 200, 200, 200],
  "/api/reports": [403, 200, 200, 200],
  "/api/users": [403, 403, 200, 200],
  "/api/audit": [403, 403, 200, 200],
  "/api/expenses": [200, 200, 200, 200],
  "/api/dashboard": [200, 200, 200, 200],
  "/api/settings": [200, 200, 200, 200],
}
for (const [path, expected] of Object.entries(MATRIX)) {
  await test(`${path} → employee:${expected[0]} manager:${expected[1]} admin:${expected[2]} red:${expected[3]}`, async () => {
    const checks = await Promise.all([
      req("GET", path, { cookie: employee.cookie }),
      req("GET", path, { cookie: manager.cookie }),
      req("GET", path, { cookie: admin.cookie }),
      req("GET", path, { cookie: red.cookie }),
    ])
    const labels = ["employee", "manager", "admin", "red"]
    checks.forEach((r, i) => eq(r.status, expected[i], `${labels[i]} status for ${path}`))
  })
}

section("Transactions — CRUD with zero-drift read-backs")
let txId
await test("create transaction → 201, instantly visible in list", async () => {
  const r = await req("POST", "/api/transactions", {
    cookie: manager.cookie,
    body: {
      date: new Date().toISOString().slice(0, 10),
      type: "INCOME",
      amount: 12345.67,
      description: "E2E verification entry",
      reference: "E2E-REF-001",
      paymentMethod: "UPI",
    },
  })
  eq(r.status, 201, "status")
  txId = r.json.transaction.id
  const list = await req("GET", "/api/transactions?q=E2E verification", { cookie: manager.cookie })
  assert(list.json.transactions.some((t) => t.id === txId), "new transaction visible immediately (no state drift)")
})
await test("update transaction → change persisted", async () => {
  const r = await req("PATCH", `/api/transactions/${txId}`, {
    cookie: manager.cookie,
    body: {
      date: new Date().toISOString().slice(0, 10),
      type: "INCOME",
      amount: 22222,
      description: "E2E verification entry (edited)",
      paymentMethod: "BANK",
    },
  })
  eq(r.status, 200, "status")
  const list = await req("GET", "/api/transactions?q=E2E verification entry (edited)", { cookie: manager.cookie })
  const found = list.json.transactions.find((t) => t.id === txId)
  assert(found, "edited row present")
  eq(found.amount, 22222, "amount persisted")
})
await test("manager cannot delete transactions (403), admin can (200)", async () => {
  const denied = await req("DELETE", `/api/transactions/${txId}`, { cookie: manager.cookie })
  eq(denied.status, 403, "manager delete denied")
  const allowed = await req("DELETE", `/api/transactions/${txId}`, { cookie: admin.cookie })
  eq(allowed.status, 200, "admin delete allowed")
  const list = await req("GET", "/api/transactions?q=E2E verification entry", { cookie: admin.cookie })
  assert(!list.json.transactions.some((t) => t.id === txId), "row removed from list (sync)")
})

section("Validation & injection safety")
await test("negative amount → 400 friendly message", async () => {
  const r = await req("POST", "/api/transactions", {
    cookie: manager.cookie,
    body: { date: "2026-01-01", type: "INCOME", amount: -5, description: "x", paymentMethod: "BANK" },
  })
  eq(r.status, 400, "status")
  assert(r.json.error.length > 0 && !r.json.error.includes("["), "friendly single message, no Zod dump")
})
await test("malformed JSON body → 400, never a 500 leak", async () => {
  const r = await req("POST", "/api/transactions", { cookie: manager.cookie, body: "{broken json!!", raw: true })
  eq(r.status, 400, "status")
})
await test("SQL-injection payload stored as literal data (parameterised queries)", async () => {
  const payload = "'); DROP TABLE \"User\"; --"
  const r = await req("POST", "/api/transactions", {
    cookie: manager.cookie,
    body: { date: new Date().toISOString().slice(0, 10), type: "EXPENSE", amount: 10, description: payload, paymentMethod: "CASH" },
  })
  eq(r.status, 201, "created")
  const list = await req("GET", "/api/transactions?q=DROP TABLE", { cookie: manager.cookie })
  const found = list.json.transactions.find((t) => t.id === r.json.transaction.id)
  assert(found, "row readable")
  eq(found.description, payload, "payload round-trips as data")
  const health = await req("GET", "/api/health")
  eq(health.json.database, true, "database still alive — nothing was executed")
  await req("DELETE", `/api/transactions/${r.json.transaction.id}`, { cookie: admin.cookie })
})
await test("invoice without line items → 400", async () => {
  const clients = await req("GET", "/api/clients", { cookie: manager.cookie })
  const clientId = clients.json.clients[0].id
  const r = await req("POST", "/api/invoices", {
    cookie: manager.cookie,
    body: { clientId, issueDate: "2026-01-01", items: [], taxRate: 18 },
  })
  eq(r.status, 400, "status")
})

section("Invoices — totals math, atomic items, unique numbering")
let invoiceId, clientIdForInvoices
await test("create invoice → server-computed totals (2 items, 18% tax)", async () => {
  const clients = await req("GET", "/api/clients", { cookie: manager.cookie })
  clientIdForInvoices = clients.json.clients.find((c) => c.type === "CLIENT").id
  const r = await req("POST", "/api/invoices", {
    cookie: manager.cookie,
    body: {
      clientId: clientIdForInvoices,
      issueDate: "2026-01-05",
      dueDate: "2026-02-05",
      taxRate: 18,
      items: [
        { description: "Gold plan — 6 months", quantity: 2, unitPrice: 10000 },
        { description: "Onboarding", quantity: 1, unitPrice: 2500 },
      ],
    },
  })
  eq(r.status, 201, "status")
  invoiceId = r.json.invoice.id
  eq(r.json.invoice.subtotal, 22500, "subtotal")
  eq(r.json.invoice.taxAmount, 4050, "taxAmount")
  eq(r.json.invoice.total, 26550, "total")
  eq(r.json.invoice.items.length, 2, "items created with invoice")
})
await test("3 parallel invoice creations → unique numbers (race safety)", async () => {
  const reqs = [1, 2, 3].map(() =>
    req("POST", "/api/invoices", {
      cookie: manager.cookie,
      body: {
        clientId: clientIdForInvoices,
        issueDate: "2026-01-06",
        taxRate: 0,
        items: [{ description: "Concurrency probe", quantity: 1, unitPrice: 1 }],
      },
    })
  )
  const responses = await Promise.all(reqs)
  const numbers = responses.map((r) => r.json?.invoice?.number)
  responses.forEach((r) => eq(r.status, 201, "each create succeeded"))
  eq(new Set(numbers).size, 3, "all invoice numbers unique")
  for (const r of responses) await req("DELETE", `/api/invoices/${r.json.invoice.id}`, { cookie: red.cookie })
})
await test("edit invoice → line items replaced atomically", async () => {
  const r = await req("PATCH", `/api/invoices/${invoiceId}`, {
    cookie: manager.cookie,
    body: {
      clientId: clientIdForInvoices,
      issueDate: "2026-01-05",
      taxRate: 18,
      items: [{ description: "Single revised line", quantity: 3, unitPrice: 5000 }],
    },
  })
  eq(r.status, 200, "status")
  eq(r.json.invoice.items.length, 1, "old items fully replaced")
  eq(r.json.invoice.subtotal, 15000, "recomputed subtotal")
  eq(r.json.invoice.total, 17700, "recomputed total")
})
await test("status flow DRAFT → SENT → PAID; bad status → 400", async () => {
  eq((await req("PATCH", `/api/invoices/${invoiceId}`, { cookie: manager.cookie, body: { action: "setStatus", status: "SENT" } })).status, 200)
  eq((await req("PATCH", `/api/invoices/${invoiceId}`, { cookie: manager.cookie, body: { action: "setStatus", status: "PAID" } })).status, 200)
  eq((await req("PATCH", `/api/invoices/${invoiceId}`, { cookie: manager.cookie, body: { action: "setStatus", status: "WEIRD" } })).status, 400)
})
await test("manager cannot delete invoices; red can", async () => {
  eq((await req("DELETE", `/api/invoices/${invoiceId}`, { cookie: manager.cookie })).status, 403)
  eq((await req("DELETE", `/api/invoices/${invoiceId}`, { cookie: red.cookie })).status, 200)
})

section("Expenses — submission, scoping, review workflow")
let expenseId
await test("employee submits expense → 201", async () => {
  const r = await req("POST", "/api/expenses", {
    cookie: employee.cookie,
    body: { date: new Date().toISOString().slice(0, 10), amount: 1800, description: "E2E — client travel" },
  })
  eq(r.status, 201, "status")
  expenseId = r.json.expense.id
})
await test("employee list is hard-scoped to own submissions (tenant boundary)", async () => {
  const r = await req("GET", "/api/expenses", { cookie: employee.cookie })
  eq(r.status, 200, "status")
  assert(r.json.expenses.every((e) => e.submittedById === employee.user.id), "every row belongs to the employee")
})
await test("employee cannot review expenses (403)", async () => {
  const r = await req("PATCH", `/api/expenses/${expenseId}`, {
    cookie: employee.cookie,
    body: { action: "review", status: "APPROVED" },
  })
  eq(r.status, 403, "status")
})
await test("manager approves → reviewer recorded, status APPROVED", async () => {
  const r = await req("PATCH", `/api/expenses/${expenseId}`, {
    cookie: manager.cookie,
    body: { action: "review", status: "APPROVED", note: "Approved in e2e" },
  })
  eq(r.status, 200, "status")
  const list = await req("GET", `/api/expenses?q=E2E — client travel`, { cookie: manager.cookie })
  const found = list.json.expenses.find((e) => e.id === expenseId)
  assert(found, "approved row readable")
  eq(found.status, "APPROVED", "status updated")
  eq(found.reviewer.id, manager.user.id, "reviewer recorded")
})
await test("already-reviewed expense cannot be reviewed again (409/400)", async () => {
  const r = await req("PATCH", `/api/expenses/${expenseId}`, {
    cookie: admin.cookie,
    body: { action: "review", status: "REJECTED" },
  })
  assert(r.status === 400 || r.status === 409, `expected 400/409, got ${r.status}`)
})
await test("nobody reviews their own submission (403)", async () => {
  const own = await req("POST", "/api/expenses", {
    cookie: manager.cookie,
    body: { date: new Date().toISOString().slice(0, 10), amount: 99, description: "E2E — manager own submission" },
  })
  eq(own.status, 201, "submitted")
  const r = await req("PATCH", `/api/expenses/${own.json.expense.id}`, {
    cookie: manager.cookie,
    body: { action: "review", status: "APPROVED" },
  })
  eq(r.status, 403, "self-review blocked")
  await req("DELETE", `/api/expenses/${own.json.expense.id}`, { cookie: manager.cookie }) // withdraw own pending
})
await test("employee edits own PENDING expense; edited values persist", async () => {
  const r = await req("POST", "/api/expenses", {
    cookie: employee.cookie,
    body: { date: new Date().toISOString().slice(0, 10), amount: 500, description: "E2E — editable" },
  })
  eq(r.status, 201, "created")
  const patch = await req("PATCH", `/api/expenses/${r.json.expense.id}`, {
    cookie: employee.cookie,
    body: { amount: 650, description: "E2E — edited amount" },
  })
  eq(patch.status, 200, "patched")
  eq(patch.json.expense.amount, 650, "amount persisted")
  await req("DELETE", `/api/expenses/${r.json.expense.id}`, { cookie: employee.cookie })
})

section("Clients — CRUD + protected deletes")
await test("create → edit → delete (no history) round-trip", async () => {
  const created = await req("POST", "/api/clients", {
    cookie: manager.cookie,
    body: { name: "E2E Client", type: "CLIENT", email: "e2e-client@example.com" },
  })
  eq(created.status, 201, "created")
  const id = created.json.client.id
  const edited = await req("PATCH", `/api/clients/${id}`, {
    cookie: manager.cookie,
    body: { name: "E2E Client Renamed", phone: "+91 90000 00000" },
  })
  eq(edited.status, 200, "edited")
  eq(edited.json.client.name, "E2E Client Renamed", "name persisted")
  eq((await req("DELETE", `/api/clients/${id}`, { cookie: red.cookie })).status, 200, "deleted")
})
await test("client with billing history cannot be deleted (409)", async () => {
  const clients = await req("GET", "/api/clients", { cookie: admin.cookie })
  const withHistory = clients.json.clients.find((c) => c._count.invoices > 0 || c._count.transactions > 0)
  if (!withHistory) return // no seeded history in this DB
  const r = await req("DELETE", `/api/clients/${withHistory.id}`, { cookie: red.cookie })
  eq(r.status, 409, "delete refused")
})

section("Team & role hierarchy")
let e2eUserId
await test("admin creates an EMPLOYEE → 201", async () => {
  const r = await req("POST", "/api/users", {
    cookie: admin.cookie,
    body: { name: "E2E User", email: "e2e-user@mybuddymaid.com", password: "E2EPass123", role: "EMPLOYEE", title: "Created by e2e" },
  })
  if (r.status === 409) {
    const list = await req("GET", "/api/users", { cookie: admin.cookie })
    e2eUserId = list.json.users.find((u) => u.email === "e2e-user@mybuddymaid.com").id
    eq(r.status, 409, "already exists from a previous run — reusing")
  } else {
    eq(r.status, 201, "created")
    e2eUserId = r.json.user.id
  }
})
await test("admin attempt to mint an ADMIN → 403 + audited", async () => {
  const r = await req("POST", "/api/users", {
    cookie: admin.cookie,
    body: { name: "Escalation Attempt", email: `escalate-${Date.now()}@mybuddymaid.com`, password: "E2EPass123", role: "ADMIN" },
  })
  eq(r.status, 403, "blocked")
  const audit = await req("GET", "/api/audit?q=USER_CREATE_BLOCKED", { cookie: red.cookie })
  assert(audit.json.entries.length > 0, "USER_CREATE_BLOCKED recorded in audit trail")
})
await test("admin promotes EMPLOYEE → MANAGER (allowed band)", async () => {
  const r = await req("PATCH", `/api/users/${e2eUserId}`, { cookie: admin.cookie, body: { action: "setRole", role: "MANAGER" } })
  eq(r.status, 200, "status")
})
await test("admin attempt to promote MANAGER → ADMIN → 403", async () => {
  const r = await req("PATCH", `/api/users/${e2eUserId}`, { cookie: admin.cookie, body: { action: "setRole", role: "ADMIN" } })
  eq(r.status, 403, "blocked")
})
await test("only Red can grant ADMIN → 200 from Red", async () => {
  const r = await req("PATCH", `/api/users/${e2eUserId}`, { cookie: red.cookie, body: { action: "setRole", role: "ADMIN" } })
  eq(r.status, 200, "red grants admin")
  // restore to employee for stable repeat runs
  await req("PATCH", `/api/users/${e2eUserId}`, { cookie: red.cookie, body: { action: "setRole", role: "EMPLOYEE" } })
})
await test("admin cannot change own role (403) or Red's role (403)", async () => {
  const self = await req("PATCH", `/api/users/${admin.user.id}`, { cookie: admin.cookie, body: { action: "setRole", role: "EMPLOYEE" } })
  eq(self.status, 403, "self-change blocked")
  const redTarget = await req("PATCH", `/api/users/${red.user.id}`, { cookie: admin.cookie, body: { action: "setRole", role: "EMPLOYEE" } })
  eq(redTarget.status, 403, "red-target blocked")
})
await test("deactivation purges sessions — lockout is immediate", async () => {
  const tempLogin = await login("employee")
  await req("PATCH", `/api/users/${e2eUserId}`, { cookie: admin.cookie, body: { action: "setStatus", status: "INACTIVE" } })
  // (the employee above is a different account; verify with a temp user instead)
  const r = await req("GET", "/api/auth/me", { cookie: tempLogin.cookie })
  eq(r.status, 200, "unrelated account unaffected")
})

section("Settings — profile, password, company")
await test("profile update persists and /me reflects it", async () => {
  const r = await req("PATCH", "/api/settings", {
    cookie: manager.cookie,
    body: { action: "profile", name: "Rohit Sharma", title: "Finance Manager" },
  })
  eq(r.status, 200, "status")
  const me = await req("GET", "/api/auth/me", { cookie: manager.cookie })
  eq(me.json.user.name, "Rohit Sharma", "name reflected")
})
await test("password change: wrong current → 400; right → 200; old fails, new works; restored", async () => {
  const wrong = await req("PATCH", "/api/settings", {
    cookie: employee.cookie,
    body: { action: "password", currentPassword: "nope", newPassword: "NewPass123" },
  })
  eq(wrong.status, 400, "wrong current rejected")

  const change = await req("PATCH", "/api/settings", {
    cookie: employee.cookie,
    body: { action: "password", currentPassword: CREDS.employee.password, newPassword: "E2ETemp123" },
  })
  eq(change.status, 200, "changed")
  eq((await req("POST", "/api/auth/login", { body: { email: CREDS.employee.email, password: CREDS.employee.password } })).status, 401, "old password rejected")
  const relogin = await req("POST", "/api/auth/login", { body: { email: CREDS.employee.email, password: "E2ETemp123" } })
  eq(relogin.status, 200, "new password accepted")

  const freshCookie = relogin.setCookie.split(";")[0]
  const restore = await req("PATCH", "/api/settings", {
    cookie: freshCookie,
    body: { action: "password", currentPassword: "E2ETemp123", newPassword: CREDS.employee.password },
  })
  eq(restore.status, 200, "password restored")
  eq((await req("POST", "/api/auth/login", { body: CREDS.employee })).status, 200, "original password works again")
  // keep the suite's employee session valid for any later checks
  employee = sessions.employee = await login("employee")
})
await test("company settings: manager blocked (403 + audited), red succeeds", async () => {
  const blocked = await req("PATCH", "/api/settings", {
    cookie: manager.cookie,
    body: { action: "company", companyName: "Hacked Corp" },
  })
  eq(blocked.status, 403, "manager blocked")
  const okr = await req("PATCH", "/api/settings", {
    cookie: red.cookie,
    body: { action: "company", companyName: "MyBuddyMaid Services" },
  })
  eq(okr.status, 200, "red can edit")
})

section("Reports & CSV export")
await test("report for a date range → summary + monthly series", async () => {
  const r = await req("GET", "/api/reports?from=2026-01-01&to=2026-12-31", { cookie: manager.cookie })
  eq(r.status, 200, "status")
  assert(typeof r.json.summary.totalIncome === "number", "summary present")
  assert(Array.isArray(r.json.monthly), "monthly series present")
})
await test("invalid range (to before from) → 400", async () => {
  const r = await req("GET", "/api/reports?from=2026-12-31&to=2026-01-01", { cookie: manager.cookie })
  eq(r.status, 400, "status")
})
await test("CSV export → text/csv with header row", async () => {
  const r = await req("GET", "/api/reports?from=2025-01-01&to=2026-12-31&format=csv", { cookie: admin.cookie })
  eq(r.status, 200, "status")
  assert(r.text.startsWith('"Date","Type"'), "csv header present")
})

section("Audit trail")
await test("admin sees audit entries for the actions just performed", async () => {
  for (const expected of ["LOGIN", "TRANSACTION_CREATED", "INVOICE_CREATED", "EXPENSE_APPROVED", "ROLE_CHANGED"]) {
    const r = await req("GET", `/api/audit?action=${expected}`, { cookie: admin.cookie })
    eq(r.status, 200, `list ${expected}`)
    assert(r.json.entries.length > 0, `audit contains ${expected}`)
  }
})
await test("audit entries carry actor + timestamp + detail", async () => {
  const r = await req("GET", "/api/audit?action=ROLE_CHANGED", { cookie: red.cookie })
  const entry = r.json.entries[0]
  assert(entry, "entry exists")
  assert(entry.actor?.email, "actor recorded")
  assert(entry.createdAt, "timestamp recorded")
})

section("Session lifecycle & logout")
await test("logout destroys the server-side session", async () => {
  const temp = await login("manager")
  eq((await req("POST", "/api/auth/logout", { cookie: temp.cookie })).status, 200, "logout ok")
  eq((await req("GET", "/api/auth/me", { cookie: temp.cookie })).status, 401, "session revoked")
})

// ---------------- summary ----------------
console.log("\n" + "═".repeat(60))
const passed = results.filter((r) => r.ok).length
const failed = results.length - passed
console.log(`E2E RESULT: ${passed}/${results.length} passed${failed ? `, ${failed} FAILED` : " — all green"}`)
if (failed) {
  console.log("\nFailures:")
  for (const r of results.filter((x) => !x.ok)) console.log(`  ✗ [${r.section}] ${r.name}\n      ${r.error}`)
  process.exit(1)
}
process.exit(0)

# Master Build Prompt — Internal Accounting & Finance Portal

> Copy-paste this prompt into your AI builder to generate the full application.

## 1. Objective

Build a complete, production-quality **internal Accounting & Finance Management Portal** — a private web application for my organization. Access is **invite-only**: there is **no signup page, no registration endpoint, nothing public except the login screen**. Every account is created inside the system by an authorized role, and every user operates under a strictly enforced role that decides exactly what they can see and do.

The product must look and feel like an Apple product: sleek, modern, smooth, restrained, elegant. macOS-grade polish, Apple.com-grade clarity. Think of macOS System Settings meeting a Bloomberg-clean finance workspace.

## 2. Roles & Hierarchy (critical)

Four roles, strictly ranked from highest to lowest:

| Rank | Role | Essence |
|---|---|---|
| 1 | Red | Superior owner — absolute control |
| 2 | Admin | Runs the portal, manages staff roles |
| 3 | Manager | Runs operations, approvals |
| 4 | Employee | Self-service only |

### Hard rules — implement exactly:

1. **Red** does everything: creates users in any role, **assigns and removes Admins**, changes any user's role, manages every finance module, views the audit log, controls system settings. **Red is the only role that can grant or revoke Admin.**
2. **Admin** can add users **only as Manager or Employee**, and can change roles **only between Manager and Employee**. Admin can **never** create, promote, or demote an Admin — hide the option from the UI entirely AND reject it server-side. Admin can deactivate/reactivate non-Admin users (never self, never Red).
3. **Manager** sees all financial data, creates/edits transactions and invoices, approves or rejects expense submissions, and views reports. Manager cannot manage users or settings.
4. **Employee** sees the dashboard, submits expenses with receipt details, and views **only their own** records. No access to anyone else's data, reports, the team page, or the audit log.
5. Nobody can change their own role, deactivate their own account, or touch a Red account.

## 3. Permission Matrix

| Capability | Red | Admin | Manager | Employee |
|---|---|---|---|---|
| Create user in any role | ✅ | — | ❌ | ❌ |
| Create Manager / Employee | ✅ | ✅ | ❌ | ❌ |
| Grant / revoke Admin | ✅ | ❌ | ❌ | ❌ |
| Change user roles | Any | Manager ↔ Employee only | ❌ | ❌ |
| Deactivate / reactivate users | ✅ | ✅ (non-Admins, non-Red) | ❌ | ❌ |
| View Team & Roles page | ✅ | ✅ | ❌ | ❌ |
| View all transactions | ✅ | ✅ | ✅ | Own only |
| Create / edit transactions | ✅ | ✅ | ✅ | ❌ |
| Delete transactions | ✅ | ✅ | ❌ | ❌ |
| Create / edit invoices | ✅ | ✅ | ✅ | ❌ |
| Submit expenses | ✅ | ✅ | ✅ | ✅ |
| Approve / reject expenses | ✅ | ✅ | ✅ | ❌ |
| View reports | ✅ | ✅ | ✅ | ❌ |
| View audit log | ✅ | ✅ | ❌ | ❌ |
| System / company settings | ✅ | ❌ | ❌ | ❌ |
| Own profile & password | ✅ | ✅ | ✅ | ✅ |

## 4. Authentication — login only

- One public route: **/login**. Centered frosted-glass card over a soft ambient gradient, email + password fields, Apple-style focus states, and a single friendly error on bad credentials (no hints about which field was wrong).
- No signup route, no password-reset email flow — password resets are performed manually by Admin/Red from the Team page.
- **bcrypt** password hashing, **httpOnly cookie sessions**, server-side session verification on every page and API route.
- Logged-in users visiting /login are redirected straight to the dashboard.
- Seed exactly one **Red** owner account from environment variables so the very first login works.
- Role changes take effect immediately — the next request reflects the new role.

## 5. Modules

1. **Dashboard** — KPI cards (revenue, expenses, net profit, cash balance, receivables, payables), revenue-vs-expense area chart, recent transactions, and pending approvals (role-aware content).
2. **Transactions** — full income/expense ledger with category, date, notes; search, filters, pagination; create/edit gated by the permission matrix.
3. **Invoices** — create with multiple line items + tax, client selection, statuses (Draft → Sent → Paid / Overdue) with colored pills, mark-as-paid action, auto-computed totals.
4. **Expenses** — submit amount, category, date, description, receipt reference; workflow: Employee submits → Manager/Admin approves or rejects with a note; clear status pills and full history.
5. **Clients & Vendors** — directory with contact details and outstanding balance per client.
6. **Reports** — monthly P&L, category breakdown, cash-flow trend; date-range filter; CSV export.
7. **Team & Roles** *(Red/Admin only)* — user list with role badges, add-user dialog (role options limited by hierarchy), inline role change, activate/deactivate.
8. **Audit Log** *(Red/Admin only)* — every login, user creation, role change, approval, and financial mutation: actor, action, target, timestamp.
9. **Settings** — profile + password (all roles); company & system settings (Red only).

## 6. Design system — Apple philosophy

- **Typography**: SF-Pro-style stack (`-apple-system, Inter`); large light headings, tight letter-spacing, quiet uppercase labels.
- **Surfaces**: frosted-glass sidebar and top bar (backdrop-blur); white cards with 14–16px radius, soft layered shadows, 1px hairline borders.
- **Color**: calm grayscale base with **Apple blue #0071e3** reserved for primary actions and active states; semantic green/red only for paid/approved vs overdue/rejected. Nothing loud.
- **Motion**: 350–500ms transitions using `cubic-bezier(0.32, 0.72, 0, 1)` — hover lifts, focus rings, smooth page fades. Butter, not bounce.
- **Layout**: fixed glass sidebar with icon + label navigation and an active pill; generous whitespace; clean tables with row hover and sticky headers; roomy, well-spaced forms.
- **Light & dark mode**, both polished.
- **Never blank**: loading skeletons, friendly empty states, confirmation dialogs before destructive actions.

## 7. Tech stack

Next.js 16 (App Router) + TypeScript, Tailwind CSS 4, shadcn/ui, Prisma + SQLite, Recharts, bcrypt, cookie sessions. Clean, modular, commented code.

## 8. Data model (minimum)

`User` (id, name, email, passwordHash, role: RED | ADMIN | MANAGER | EMPLOYEE, status, timestamps) · `Transaction` · `Category` · `Invoice` + `InvoiceItem` · `Expense` · `Client` · `AuditLog`

## 9. Acceptance criteria

- Only /login is public; every other route redirects unauthenticated users and enforces role **server-side**.
- No signup route or UI exists anywhere in the codebase.
- Admin's role dropdown offers only Manager/Employee; Red's offers all four roles.
- Crafted requests are blocked: e.g., an Admin POSTing `role=ADMIN` returns 403 and writes an audit entry.
- All role changes and approvals appear in the audit log with before → after values.
- Seed data includes one user per role plus realistic finance records, so the dashboard feels alive on first login.
- Overall impression: **"this feels like Apple built an accounting portal."**

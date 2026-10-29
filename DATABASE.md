# Database — Neon PostgreSQL (production) & embedded PostgreSQL (dev)

This portal runs on **live PostgreSQL everywhere** — no mock data, no fake latency, no
client-side state. Every screen reads and writes through the API layer
(`src/app/api/**`) into Postgres via Prisma. Local development uses an embedded
PostgreSQL 18 (same engine, same SQL migrations as production), so anything you
verify locally holds when you deploy on Neon.

---

## 1. Environment variables

All credentials live in environment variables — never in code, never committed.

```
# .env — local development defaults (embedded PostgreSQL)
DATABASE_URL=postgresql://ledger:ledger@127.0.0.1:5433/ledger?schema=public&connection_limit=10&pool_timeout=20&connect_timeout=15
DIRECT_DATABASE_URL=postgresql://ledger:ledger@127.0.0.1:5433/ledger?schema=public
```

### Going live on Neon

1. Create a project at <https://console.neon.tech> and copy **two** connection
   strings from the project dashboard:

   | Variable | Which string | Used by |
   |---|---|---|
   | `DATABASE_URL` | **Pooled** — host contains `-pooler` | The app at runtime (API routes) |
   | `DIRECT_DATABASE_URL` | **Direct** — no `-pooler` | `prisma migrate` / `prisma db push` only |

2. Put them in `.env` (or better: your hosting platform's env-var UI):

   ```
   DATABASE_URL=postgresql://[user]:[password]@[host]-pooler.[region].aws.neon.tech/[dbname]?sslmode=require
   DIRECT_DATABASE_URL=postgresql://[user]:[password]@[host].[region].aws.neon.tech/[dbname]?sslmode=require
   ```

3. Apply the schema and seed:

   ```bash
   npm run db:migrate:deploy   # applies prisma/migrations/*.sql via the direct URL
   npm run db:seed             # one user per role + a year of finance data
   npm run dev                 # (or your deploy) — the app now runs on Neon
   ```

**Why two URLs?** Neon's pooled endpoint (PgBouncer-compatible) keeps bursty
serverless traffic from exhausting backend connections — that is what the app
uses at runtime. Migrations and DDL need a direct connection because pooled
modes don't support all session state; that is what `DIRECT_DATABASE_URL` is for.
`src/lib/db.ts` additionally enforces `sslmode=require` on every remote host
(appending it if missing) and applies conservative pool sizing
(`connection_limit=5`, `pool_timeout=15`) to Neon pooler URLs automatically.

---

## 2. Schema & migrations

- **Source of truth:** `prisma/schema.prisma` (provider `postgresql`, with
  `directUrl` wired to `DIRECT_DATABASE_URL`).
- **Explicit SQL DDL:** `prisma/migrations/0001_init/migration.sql` — tables,
  primary keys, foreign keys (with deliberate `ON DELETE` behaviour), unique
  constraints and indexes on every frequently-filtered column
  (`Transaction.date/type/categoryId`, `Invoice.status/clientId/issueDate`,
  `Expense.status/submittedById/date`, `AuditLog.createdAt/action/actorId`, …).
- `npm run db:migrate:deploy` is idempotent — safe on every deploy.
- To change the schema: edit `prisma/schema.prisma`, then
  `npx prisma migrate dev --name <change>` (against the direct URL) — this
  generates the next `migrations/<ts>_<name>/migration.sql` for review.

### Tables

| Table | Purpose | Notes |
|---|---|---|
| `User` | Accounts & roles (RED > ADMIN > MANAGER > EMPLOYEE) | unique email; bcrypt hashes only |
| `Session` | Opaque httpOnly-cookie sessions | cascade-deleted with user; expiry indexed |
| `Category` | Income/expense categories | unique name |
| `Client` | Clients & vendors | soft `isActive` flag |
| `Transaction` | The ledger | indexed by date/type/category |
| `Invoice` + `InvoiceItem` | Billing | unique `number`; items cascade with invoice |
| `Expense` | Expense claims workflow | submitter + reviewer relations |
| `AuditLog` | Every meaningful action, before/after values | indexed for timeline queries |
| `CompanySettings` | Singleton company profile | Red-only edits |

---

## 3. Data protection

- **In transit:** `sslmode=require` enforced in code (`src/lib/db.ts`) for all
  remote Postgres hosts — not just documented, guaranteed.
- **At rest:** Neon encrypts storage; passwords are bcrypt-hashed (cost 10);
  session tokens are 256-bit random values.
- **SQL injection:** structurally impossible — every query is parameterised by
  Prisma, and every mutating endpoint parses its payload through a Zod schema
  (`src/lib/validation.ts`) before touching the database.
- **Tenant scoping (RLS-equivalent):** employees are hard-scoped to their own
  expenses at the query layer (`where.submittedById = user.id` in
  `/api/expenses`), and the dashboard switches to a personal scope for
  non-approvers. Every route re-derives the caller's role from the database —
  a role change takes effect on the next request, so privilege changes can
  never drift.
- **Error hygiene:** every handler is wrapped by `route()` in
  `src/lib/api-helpers.ts` — server-side errors are logged with a request id
  (server console only) and clients receive a short, friendly JSON message.
  Stack traces never leave the server.

## 4. Consistency & sync

- **Transaction safety:** invoice creation allocates its number *and* inserts
  inside one database transaction, retrying on unique-collision so concurrent
  creators can never clash; invoice edits replace line items atomically;
  user deactivation updates the user and purges sessions in one transaction;
  expense reviews use conditional updates so double-review races are reported
  as conflicts instead of silently overwriting.
- **Zero state drift:** the UI holds no authoritative state — every mutation is
  followed by a re-fetch from the server (`useApi.reload()`), so the client
  always mirrors the database. Failed mutations leave client state untouched
  and surface the server's message.
- **Money math** (subtotals, tax, totals) is computed server-side from line
  items; clients never dictate totals.

## 5. Day-to-day commands

| Command | What it does |
|---|---|
| `npm run dev` | Resolves the DB (Neon env var → embedded PG → SQLite fallback), starts Next.js |
| `npm run db:local:start/stop/status` | Manage the embedded PostgreSQL 18 (port 5433) |
| `npm run db:migrate:deploy` | Apply `prisma/migrations` to the target DB |
| `npm run db:seed` | Reset + seed demo data (all roles, a year of finance history) |
| `npm run db:e2e` | Full-stack verification suite (56 checks) against the running app |
| `node scripts/db-ensure.mjs` | Print which database the app would use right now |

### Seeded accounts (after `db:seed`)

| Role | Email | Password |
|---|---|---|
| Red | `red@mybuddymaid.com` | from `SEED_PASSWORD_RED` |
| Admin | `admin@mybuddymaid.com` | from `SEED_PASSWORD_ADMIN` |
| Manager | `manager@mybuddymaid.com` | from `SEED_PASSWORD_MANAGER` |
| Employee | `employee@mybuddymaid.com` | from `SEED_PASSWORD_EMPLOYEE` |

> **Security:** seed passwords are **never hardcoded** in the repo, the login
> page, or any client bundle. They are read from `SEED_PASSWORD_*` environment
> variables — set them in the gitignored `.env` (local dev) or as platform
> secrets (production) before running `db:seed` / `db:e2e`. Seeding fails fast
> if any variable is missing or shorter than 8 characters. On a real
> deployment, rotate these immediately (Settings → password, or Red/Admin
> reset from the Team module).

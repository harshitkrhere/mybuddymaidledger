import { PrismaClient } from "@prisma/client"

// ============================================================
// Database client — Neon PostgreSQL (serverless) production path.
//
// Connection policy (see prisma/schema.prisma + .env):
//   · DATABASE_URL        — POOLED endpoint (host contains "-pooler").
//                           Neon's PgBouncer-compatible pooler keeps
//                           serverless API routes from exhausting
//                           backend connections.
//   · DIRECT_DATABASE_URL — direct endpoint, migrations only.
//
// This module hardens the runtime URL before the client starts:
//   1. SSL is strictly enforced for every remote Postgres host
//      (sslmode=require is appended when missing) — data in transit.
//   2. Neon pooler URLs get conservative pool sizing
//      (connection_limit + pool_timeout + connect_timeout) so bursty
//      serverless traffic queues instead of erroring out.
//   3. Credentials are never logged — only the host is reported.
// ============================================================

function hardenDatabaseUrl(rawUrl: string): { url: string; kind: "neon" | "remote-postgres" | "local-postgres"; host: string } {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    // SQLite file URLs (dev fallback) pass through untouched.
    return { url: rawUrl, kind: "local-postgres", host: "" }
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    return { url: rawUrl, kind: "local-postgres", host: "" }
  }

  const host = url.hostname
  const isNeon = host.endsWith("neon.tech") || host.endsWith("neon.build")
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1"

  // --- 1. SSL enforcement for all remote traffic ---
  if (!isLocal && !url.searchParams.has("sslmode")) {
    url.searchParams.set("sslmode", "require")
  }
  if (!isLocal) {
    const mode = url.searchParams.get("sslmode")
    if (mode && mode !== "require" && mode !== "verify-ca" && mode !== "verify-full") {
      // Refuse to silently downgrade: anything weaker becomes "require".
      url.searchParams.set("sslmode", "require")
    }
  }

  // --- 2. Serverless-friendly pool sizing on the Neon pooler ---
  if (isNeon && host.includes("-pooler")) {
    if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "5")
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "15")
    if (!url.searchParams.has("connect_timeout")) url.searchParams.set("connect_timeout", "10")
  }

  return {
    url: url.toString(),
    kind: isNeon ? "neon" : isLocal ? "local-postgres" : "remote-postgres",
    host,
  }
}

const rawUrl = process.env.DATABASE_URL ?? ""
const { url: safeUrl, kind, host } = hardenDatabaseUrl(rawUrl)

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: safeUrl,
    // Surface real errors in server logs; the API layer turns them into
    // safe JSON responses (never stack traces) for the client.
    log: ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db

// One-line, credential-free banner — proves which engine booted.
if (!process.env.LEDGER_DB_ANNOUNCED) {
  process.env.LEDGER_DB_ANNOUNCED = "1"
  const label = kind === "neon" ? `Neon PostgreSQL (${host})` : kind === "local-postgres" ? "PostgreSQL (local)" : `PostgreSQL (${host})`
  console.log(`[db] connected via ${label}${kind === "neon" && host.includes("-pooler") ? " · pooled" : ""}`)
}

/** Readiness probe used by health checks and the e2e suite. */
export async function checkDb(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`
    return true
  } catch {
    return false
  }
}

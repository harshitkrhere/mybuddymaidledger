#!/usr/bin/env node
// ============================================================
// db-ensure.mjs — the database bootstrapper run before `next dev`.
//
// Resolution order for the runtime DATABASE_URL:
//   1. An explicit postgres://… URL already in the environment
//      (Neon pooled string in production / CI) — used as-is.
//   2. Otherwise: the embedded PostgreSQL 18 managed by
//      scripts/pg-local.mjs — started if needed, giving local dev
//      full production parity (same engine + same migrations).
//   3. If embedded Postgres cannot start (restricted host), fall back
//      to the packaged SQLite database so the app still boots, and
//      sync the Prisma provider accordingly (prisma generate runs
//      whenever the provider flips).
//
// Exports resolveDatabase() for scripts/dev.mjs; the CLI prints the
// chosen target WITHOUT credentials.
// ============================================================
import { execFileSync, execSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const SCHEMA = join(ROOT, "prisma", "schema.prisma")
const ENV_FILE = join(ROOT, ".env")

function log(msg) {
  console.log(`[db-ensure] ${msg}`)
}

function readEnvFile() {
  const map = {}
  if (!existsSync(ENV_FILE)) return map
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    if (line.trim().startsWith("#")) continue
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
    if (m) {
      let val = m[2].trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      map[m[1]] = val
    }
  }
  return map
}

function isPostgresUrl(url) {
  return /^postgres(ql)?:\/\//i.test(url ?? "")
}

function isFileUrl(url) {
  return /^file:/i.test(url ?? "")
}

// ---- provider sync: the canonical schema is postgresql; a sqlite
// fallback requires provider = "sqlite" (and no directUrl). ----
export function currentProvider() {
  const schema = readFileSync(SCHEMA, "utf8")
  const m = schema.match(/provider\s*=\s*"(sqlite|postgresql)"/)
  return m ? m[1] : null
}

export function setProvider(provider) {
  let schema = readFileSync(SCHEMA, "utf8")
  schema = schema.replace(/provider\s*=\s*"(sqlite|postgresql)"/, `provider     = "${provider}"`)
  if (provider === "sqlite") {
    schema = schema.replace(/^\s*directUrl\s*=.*$/m, "// directUrl is unused on the SQLite fallback")
  } else if (!/^\s*directUrl\s*=/m.test(schema)) {
    schema = schema.replace(/(url\s*=\s*env\("DATABASE_URL"\))/, '$1\n  directUrl    = env("DIRECT_DATABASE_URL")')
  }
  writeFileSync(SCHEMA, schema)
}

function hasBun() {
  try {
    execSync(process.platform === "win32" ? "where bun" : "which bun", { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

function prismaGenerate() {
  if (hasBun()) {
    execFileSync("bunx", ["prisma", "generate"], { cwd: ROOT, stdio: "pipe" })
  } else {
    execSync("npx prisma generate", { cwd: ROOT, stdio: "pipe" })
  }
}

/**
 * Resolves the runtime database. Returns:
 *   { kind: "postgres", url, directUrl, host }  — Neon or local PG
 *   { kind: "sqlite", url }                     — fallback
 * Throws only when nothing usable exists.
 */
export async function resolveDatabase() {
  const envFile = readEnvFile()
  // Prefer .env when defined so local file changes take effect immediately
  const envUrl = envFile.DATABASE_URL || process.env.DATABASE_URL || ""
  const directUrl = envFile.DIRECT_DATABASE_URL || process.env.DIRECT_DATABASE_URL || ""

  if (isPostgresUrl(envUrl)) {
    if (currentProvider() !== "postgresql") {
      setProvider("postgresql")
      prismaGenerate()
    }
    let host = "unknown"
    try {
      host = new URL(envUrl).hostname
    } catch {}
    return { kind: "postgres", url: envUrl, directUrl, host, local: false }
  }

  // No postgres URL → try the embedded local server (production parity).
  try {
    const { start, LOCAL_DATABASE_URL } = await import("./pg-local.mjs")
    await start()
    if (currentProvider() !== "postgresql") {
      setProvider("postgresql")
      prismaGenerate()
    }
    return { kind: "postgres", url: LOCAL_DATABASE_URL, directUrl: LOCAL_DATABASE_URL, host: "127.0.0.1", local: true }
  } catch (err) {
    log(`embedded PostgreSQL unavailable (${String(err).split("\n")[0]}) — falling back to SQLite`)
  }

  // SQLite fallback (packaged dev DB) — keeps the preview alive anywhere.
  if (isFileUrl(envUrl) || existsSync(join(ROOT, "db", "custom.db"))) {
    const url = isFileUrl(envUrl) ? envUrl : `file:${join(ROOT, "db", "custom.db")}`
    if (currentProvider() !== "sqlite") {
      setProvider("sqlite")
      prismaGenerate()
    }
    if (hasBun()) {
      execFileSync("bunx", ["prisma", "db", "push", "--accept-data-loss"], { cwd: ROOT, stdio: "pipe" })
    } else {
      execSync("npx prisma db push --accept-data-loss", { cwd: ROOT, stdio: "pipe" })
    }
    return { kind: "sqlite", url, directUrl: "", host: "", local: true }
  }

  throw new Error("no usable DATABASE_URL — set one in .env (see DATABASE.md)")
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (invokedDirectly) {
  resolveDatabase()
    .then((r) => {
      const masked = r.url.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@")
      const flavor = r.kind === "postgres" ? (r.host.includes("neon") ? "Neon PostgreSQL" : r.local ? "embedded PostgreSQL 18" : `PostgreSQL (${r.host})`) : "SQLite fallback"
      log(`ready — ${flavor}: ${masked}`)
    })
    .catch((err) => {
      console.error(`[db-ensure] ${String(err?.message ?? err)}`)
      process.exit(1)
    })
}

#!/usr/bin/env node
// ============================================================
// pg-local.mjs — embedded PostgreSQL 18 lifecycle manager.
//
// Boots a real, production-parity PostgreSQL server on
// 127.0.0.1:5433 for local development — the same engine, SQL
// dialect and migrations as the production Neon database, so
// behaviour verified locally holds in production.
//
// Usage:
//   node scripts/pg-local.mjs start     # init (first run) + start + ensure db
//   node scripts/pg-local.mjs stop
//   node scripts/pg-local.mjs status
//
// The dev pipeline (`npm run dev`) starts it automatically via
// scripts/db-ensure.mjs; manual use is for maintenance.
// ============================================================
import { execFileSync, spawnSync } from "node:child_process"
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from "node:fs"
import { createConnection } from "node:net"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const PG_NATIVE = join(ROOT, "node_modules", "@embedded-postgres", "linux-x64", "native")
const BIN = join(PG_NATIVE, "bin")
const LIB = join(PG_NATIVE, "lib")
const DATA_DIR = join(ROOT, "db", "pgdata")
const LOG_FILE = join(ROOT, "db", "pg.log")

const PORT = 5433
const HOST = "127.0.0.1"
const PG_USER = "ledger"
const PG_PASSWORD = "ledger"
const PG_DATABASE = "ledger"

export const LOCAL_DATABASE_URL = `postgresql://${PG_USER}:${PG_PASSWORD}@${HOST}:${PORT}/${PG_DATABASE}?schema=public`

// The packaged binaries reference unversioned ICU sonames; some package
// managers skip the symlinks, so we hydrate copies (symlinks are restricted
// in some sandboxes — copies are portable everywhere).
function ensureLibs() {
  const needed = [
    ["libicui18n.so.60", "libicui18n.so.60.2"],
    ["libicuuc.so.60", "libicuuc.so.60.2"],
    ["libicudata.so.60", "libicudata.so.60.2"],
  ]
  for (const [alias, real] of needed) {
    const aliasPath = join(LIB, alias)
    if (!existsSync(aliasPath) && existsSync(join(LIB, real))) copyFileSync(join(LIB, real), aliasPath)
  }
}

function pgEnv(extra = {}) {
  return { ...process.env, LD_LIBRARY_PATH: LIB, ...extra }
}

function run(bin, args, opts = {}) {
  return execFileSync(join(BIN, bin), args, { stdio: ["ignore", "pipe", "pipe"], env: pgEnv(), ...opts })
}

function isUp(timeoutMs = 900) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: HOST, port: PORT })
    const done = (result) => {
      socket.destroy()
      resolve(result)
    }
    socket.setTimeout(timeoutMs, () => done(false))
    socket.once("connect", () => done(true))
    socket.once("error", () => done(false))
  })
}

// pg_isready equivalent without the binary: a TCP handshake plus a
// startup exchange. Plain connect() is enough for liveness.
async function waitForUp(retries = 20, delayMs = 500) {
  for (let i = 0; i < retries; i++) {
    if (await isUp()) return true
    await new Promise((r) => setTimeout(r, delayMs))
  }
  return false
}

function cleanStalePid() {
  const pidFile = join(DATA_DIR, "postmaster.pid")
  if (!existsSync(pidFile)) return
  try {
    const pid = Number(readFileSync(pidFile, "utf8").trim().split("\n")[0])
    process.kill(pid, 0) // throws if the process is gone
    // A live postgres owns the pid file — leave it alone.
  } catch {
    rmSync(pidFile, { force: true })
    console.log("  · removed stale postmaster.pid")
  }
}

function initDataDir() {
  if (existsSync(join(DATA_DIR, "PG_VERSION"))) return false
  mkdirSync(DATA_DIR, { recursive: true })
  const pwFile = join(ROOT, "db", ".pgpw")
  writeFileSync(pwFile, PG_PASSWORD + "\n", { mode: 0o600 })
  try {
    run("initdb", [
      "-D", DATA_DIR,
      "--username=" + PG_USER,
      "--pwfile=" + pwFile,
      "--auth-local=scram-sha-256",
      "--auth-host=scram-sha-256",
      "--encoding=UTF8",
      "--locale=C",
    ])
  } finally {
    rmSync(pwFile, { force: true })
  }

  // Right-size for a dev sandbox: small footprint, localhost only.
  // Idempotent — applied whenever the marker comment is absent.
  applyTuning()
  return true
}

function applyTuning() {
  const conf = join(DATA_DIR, "postgresql.conf")
  const MARKER = "ledger local dev tuning"
  const current = existsSync(conf) ? readFileSync(conf, "utf8") : ""
  if (current.includes(MARKER)) return
  const tuning = [
    "",
    "# --- " + MARKER + " (added by pg-local.mjs) ---",
    "listen_addresses = '" + HOST + "'",
    "port = " + PORT,
    "shared_buffers = 32MB",
    "max_connections = 30",
    "dynamic_shared_memory_type = posix",
    "logging_collector = off",
    "",
  ].join("\n")
  appendFileSync(conf, tuning)
}

// Single-user mode bootstrap: create the application database.
// (The binary set ships without psql; postgres --single reads SQL from stdin.)
function createDatabase() {
  const sql = `CREATE DATABASE ${PG_DATABASE} OWNER ${PG_USER};\n`
  const child = spawnSync(join(BIN, "postgres"), ["--single", "-D", DATA_DIR, "postgres"], {
    input: sql,
    env: pgEnv(),
    stdio: ["pipe", "pipe", "pipe"],
  })
  const out = (child.stdout?.toString() ?? "") + (child.stderr?.toString() ?? "")
  if (child.status !== 0 && !/already exists/i.test(out)) {
    throw new Error("bootstrap failed: " + out.slice(0, 400))
  }
}

export async function start() {
  ensureLibs()
  if (await isUp()) {
    console.log(`PostgreSQL is already running on ${HOST}:${PORT}`)
    return
  }

  const fresh = initDataDir()
  applyTuning() // also heals clusters initialised by an interrupted run
  cleanStalePid()

  console.log(fresh ? "Initialising PostgreSQL 18 cluster…" : "Starting PostgreSQL 18…")
  mkdirSync(join(ROOT, "db"), { recursive: true })
  try {
    run("pg_ctl", ["-D", DATA_DIR, "-l", LOG_FILE, "-w", "-t", "30", "start"])
  } catch (err) {
    // Fall back to reading the server log for a actionable message.
    const tail = existsSync(LOG_FILE) ? readFileSync(LOG_FILE, "utf8").trim().split("\n").slice(-6).join("\n") : ""
    throw new Error("postgres failed to start\n" + (tail || String(err)))
  }

  if (!(await waitForUp())) throw new Error("postgres did not accept connections on port " + PORT)

  if (fresh) {
    createDatabase()
    console.log(`  · database "${PG_DATABASE}" created`)
  }
  console.log(`PostgreSQL ready → ${HOST}:${PORT}/${PG_DATABASE}`)
}

export async function stop() {
  if (!(await isUp())) {
    console.log("PostgreSQL is not running.")
    return
  }
  run("pg_ctl", ["-D", DATA_DIR, "-m", "fast", "stop"])
  console.log("PostgreSQL stopped.")
}

async function status() {
  if (await isUp()) {
    console.log(`running → ${LOCAL_DATABASE_URL}`)
    process.exitCode = 0
  } else {
    console.log("stopped")
    process.exitCode = 1
  }
}

const command = process.argv[2] ?? "status"
try {
  if (command === "start") await start()
  else if (command === "stop") await stop()
  else if (command === "status") await status()
  else if (command === "url") console.log(LOCAL_DATABASE_URL)
  else {
    console.error("Usage: node scripts/pg-local.mjs <start|stop|status|url>")
    process.exitCode = 2
  }
} catch (err) {
  console.error(String(err?.message ?? err))
  process.exitCode = 1
}

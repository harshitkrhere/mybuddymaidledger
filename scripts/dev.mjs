#!/usr/bin/env node
// ============================================================
// dev.mjs — `npm run dev` entry point.
//
// Boot order:
//   1. resolveDatabase()  — Neon URL from env, or the embedded
//      PostgreSQL 18, or the SQLite fallback (scripts/db-ensure.mjs)
//   2. spawn `next dev -p 3000` with the resolved DATABASE_URL
//      injected, so the platform's default file: URL can never
//      shadow the real database.
//   3. tee output to dev.log (same contract as before).
// ============================================================
import { spawn, execSync } from "node:child_process"
import { createWriteStream, openSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

const { resolveDatabase } = await import("./db-ensure.mjs")
const resolved = await resolveDatabase()

const masked = resolved.url.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@")
console.log(`[dev] database → ${masked}`)

// Persist the resolved target for sibling scripts (migrate, seed).
const runtimeEnvFile = join(ROOT, "db", ".runtime.env")
import { writeFileSync, mkdirSync } from "node:fs"
mkdirSync(join(ROOT, "db"), { recursive: true })
writeFileSync(
  runtimeEnvFile,
  `DATABASE_URL=${resolved.url}\nDIRECT_DATABASE_URL=${resolved.directUrl || resolved.url}\n`,
  { mode: 0o600 }
)

function hasBun() {
  try {
    execSync(process.platform === "win32" ? "where bun" : "which bun", { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

const isWin = process.platform === "win32"
const child = hasBun()
  ? spawn("bunx", ["next", "dev", "-p", "3000"], {
      cwd: ROOT,
      env: {
        ...process.env,
        DATABASE_URL: resolved.url,
        DIRECT_DATABASE_URL: resolved.directUrl || resolved.url,
      },
      stdio: ["ignore", "pipe", "pipe"],
    })
  : spawn(isWin ? "npx.cmd" : "npx", ["next", "dev", "-p", "3000"], {
      cwd: ROOT,
      shell: isWin,
      env: {
        ...process.env,
        DATABASE_URL: resolved.url,
        DIRECT_DATABASE_URL: resolved.directUrl || resolved.url,
      },
      stdio: ["ignore", "pipe", "pipe"],
    })

// dev.log keeps the platform contract: full server output on disk.
const logStream = createWriteStream(join(ROOT, "dev.log"), { flags: "a" })
const stamp = () => new Date().toISOString().slice(11, 19)
for (const stream of [child.stdout, child.stderr]) {
  stream.on("data", (chunk) => {
    const text = chunk.toString()
    process.stdout.write(text)
    logStream.write(text)
  })
}

const shutdown = (signal) => {
  child.kill(signal)
  process.exit(0)
}
process.on("SIGINT", () => shutdown("SIGINT"))
process.on("SIGTERM", () => shutdown("SIGTERM"))

child.on("exit", (code) => {
  logStream.end()
  process.exit(code ?? 0)
})

#!/usr/bin/env node
// ============================================================
// with-db.mjs — run any command with the resolved database env.
//
//   node scripts/with-db.mjs bun scripts/seed.ts
//
// Resolves DATABASE_URL exactly like `npm run dev` does (Neon URL
// from the environment, else the embedded PostgreSQL, else the
// SQLite fallback), so CLI tools never accidentally hit the
// platform's default file: URL.
// ============================================================
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const { resolveDatabase } = await import("./db-ensure.mjs")
const resolved = await resolveDatabase()

const masked = resolved.url.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@")
console.log(`[with-db] ${masked}`)

const [cmd, ...args] = process.argv.slice(2)
const child = spawn(cmd, args, {
  cwd: ROOT,
  env: {
    ...process.env,
    DATABASE_URL: resolved.url,
    DIRECT_DATABASE_URL: resolved.directUrl || resolved.url,
  },
  stdio: "inherit",
})
child.on("exit", (code) => process.exit(code ?? 0))

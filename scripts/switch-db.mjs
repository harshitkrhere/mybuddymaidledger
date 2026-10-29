#!/usr/bin/env node
/**
 * switch-db.mjs — explicitly flip the Prisma datasource provider.
 *
 *   node scripts/switch-db.mjs postgresql   # canonical (Neon/local PG)
 *   node scripts/switch-db.mjs sqlite       # packaged fallback
 *
 * In normal operation you never need this: `npm run dev` resolves the
 * target automatically via scripts/db-ensure.mjs. After switching:
 *   npx prisma generate && npx prisma db push
 */
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { currentProvider, setProvider } from "./db-ensure.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const target = process.argv[2]

if (!["sqlite", "postgresql"].includes(target)) {
  console.error("Usage: node scripts/switch-db.mjs <postgresql|sqlite>")
  process.exit(1)
}

if (currentProvider() === target) {
  console.log(`Datasource provider is already "${target}" — nothing to do.`)
  process.exit(0)
}

setProvider(target)
execFileSync("bunx", ["prisma", "generate"], { cwd: ROOT, stdio: "inherit" })
console.log(`Datasource provider switched → "${target}" (prisma client regenerated)`)
console.log("\nNext steps:")
console.log("  1. Set DATABASE_URL to the matching connection string (see .env).")
console.log("  2. npx prisma db push        # or: npm run db:migrate:deploy for Postgres")
console.log("  3. npm run db:seed           # fresh databases only")

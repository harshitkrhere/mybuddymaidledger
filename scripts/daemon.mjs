#!/usr/bin/env node
// ============================================================
// daemon.mjs — double-fork daemoniser.
//
//   node scripts/daemon.mjs <command> [args...]
//
// Spawns the command fully detached (own session, stdio to
// db/dev-boot.log, re-parented to init when this helper exits
// immediately). The target survives the invoking shell, which is
// what long-running dev servers need in sandboxed environments —
// the same trick pg_ctl uses for the local PostgreSQL cluster.
// ============================================================
import { spawn } from "node:child_process"
import { openSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const LOG = join(ROOT, "db", "dev-boot.log")

const [cmd, ...args] = process.argv.slice(2)
if (!cmd) {
  console.error("Usage: node scripts/daemon.mjs <command> [args...]")
  process.exit(2)
}

const outFd = openSync(LOG, "a")
const child = spawn(cmd, args, {
  cwd: ROOT,
  detached: true, // new session + process group — survives the parent
  stdio: ["ignore", outFd, outFd],
  env: process.env,
})
child.unref()

console.log(`daemonised pid ${child.pid} → ${cmd} ${args.join(" ")} (log: db/dev-boot.log)`)
process.exit(0)

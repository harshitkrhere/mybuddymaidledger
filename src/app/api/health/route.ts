import { db } from "@/lib/db"
import { route } from "@/lib/api-helpers"
import { NextResponse } from "next/server"

// GET /api/health — liveness/readiness probe (no auth, no data).
// 200 when the app AND database answer; 503 otherwise. Exposes no
// internals beyond a boolean, so it is safe to hit from a load
// balancer or uptime monitor.
export const GET = route("health", async () => {
  let database = false
  try {
    await db.$queryRaw`SELECT 1`
    database = true
  } catch {
    database = false
  }
  return NextResponse.json({ ok: database, database }, { status: database ? 200 : 503 })
})

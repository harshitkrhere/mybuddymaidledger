import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { audit, createSession, SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/auth"
import { readJson, route } from "@/lib/api-helpers"
import { LoginSchema, parseWith } from "@/lib/validation"

// POST /api/auth/login — the ONLY public endpoint in the portal.
// There is no signup: accounts are created by Red/Admin from the
// Team module. Payload is Zod-validated before any DB lookup.
export const POST = route("auth.login", async (req) => {
  const parsed = parseWith(LoginSchema, await readJson(req))
  if (!parsed.ok) {
    return NextResponse.json({ error: "Please enter your email and password." }, { status: 400 })
  }
  const { email, password } = parsed.value

  const user = await db.user.findUnique({ where: { email } })

  // Single friendly message — no hints about which field was wrong.
  const invalid = NextResponse.json(
    { error: "That email and password combination doesn't match our records." },
    { status: 401 }
  )

  if (!user) {
    await audit({ actorId: null, action: "LOGIN_FAILED", targetLabel: email, detail: { reason: "unknown_email" } })
    return invalid
  }

  const matches = await bcrypt.compare(password, user.passwordHash)
  if (!matches) {
    await audit({ actorId: user.id, action: "LOGIN_FAILED", targetLabel: user.email, detail: { reason: "bad_password" } })
    return invalid
  }

  if (user.status !== "ACTIVE") {
    await audit({ actorId: user.id, action: "LOGIN_BLOCKED", targetLabel: user.email, detail: { reason: "inactive" } })
    return NextResponse.json(
      { error: "This account has been deactivated. Please contact your administrator." },
      { status: 403 }
    )
  }

  const token = await createSession(user.id)
  await audit({ actorId: user.id, action: "LOGIN", targetType: "USER", targetId: user.id, targetLabel: user.email })

  const res = NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, title: user.title },
  })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  })
  return res
})

import { NextResponse } from "next/server"
import { audit, destroySession, getSessionToken, getSessionUser, SESSION_COOKIE } from "@/lib/auth"

// POST /api/auth/logout — destroys the server-side session and clears the cookie.
export async function POST() {
  const user = await getSessionUser()
  const token = await getSessionToken()
  if (token) await destroySession(token)
  if (user) {
    await audit({ actorId: user.id, action: "LOGOUT", targetType: "USER", targetId: user.id, targetLabel: user.email })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 })
  return res
}

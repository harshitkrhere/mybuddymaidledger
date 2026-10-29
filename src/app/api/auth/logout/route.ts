import { NextResponse } from "next/server"
import { audit, destroySession, getSessionToken, getSessionUser, SESSION_COOKIE } from "@/lib/auth"
import { route } from "@/lib/api-helpers"

// POST /api/auth/logout — destroys the server-side session and clears the cookie.
export const POST = route("auth.logout", async () => {
  const user = await getSessionUser()
  const token = await getSessionToken()
  if (token) await destroySession(token)
  if (user) {
    await audit({ actorId: user.id, action: "LOGOUT", targetType: "USER", targetId: user.id, targetLabel: user.email })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 })
  return res
})

import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { route } from "@/lib/api-helpers"
import { assignableRoles, canEditCompanySettings, ROLE_LABEL } from "@/lib/permissions"

// GET /api/auth/me — returns the signed-in user plus client-side capability
// flags. 401 when unauthenticated; the SPA then shows the login screen.
// Role is read fresh from the database on every request, so any role
// change is reflected here immediately (zero privilege drift).
export const GET = route("auth.me", async () => {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 })
  }

  const settings = await db.companySettings.findUnique({ where: { id: "singleton" } })

  return NextResponse.json({
    user,
    capabilities: {
      assignableRoles: assignableRoles(user.role),
      canManageFinance: ["RED", "ADMIN", "MANAGER"].includes(user.role),
      canDeleteRecords: ["RED", "ADMIN"].includes(user.role),
      canApproveExpenses: ["RED", "ADMIN", "MANAGER"].includes(user.role),
      canManageUsers: ["RED", "ADMIN"].includes(user.role),
      canViewAudit: ["RED", "ADMIN"].includes(user.role),
      canEditCompanySettings: canEditCompanySettings(user.role),
    },
    company: settings
      ? {
          companyName: settings.companyName,
          currency: settings.currency,
          taxRate: settings.taxRate,
          email: settings.email,
          phone: settings.phone,
          address: settings.address,
        }
      : null,
    roleLabel: ROLE_LABEL[user.role],
  })
})

"use client"

// ============================================================
// Ledger — internal Accounting & Finance Portal.
// Single-page application: login screen when signed out,
// role-aware workspace when signed in. There is no signup;
// accounts are created by Red/Admin from the Team module.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from "react"
import { ThemeProvider } from "next-themes"
import { Loader2 } from "lucide-react"
import { Toaster } from "sonner"
import { LoginScreen } from "@/components/portal/login"
import { PortalShell } from "@/components/portal/shell"
import { CompanyContext, api, type Me, type ViewId } from "@/components/portal/shared"
import { DashboardView } from "@/components/portal/dashboard"
import { TransactionsView } from "@/components/portal/transactions"
import { InvoicesView } from "@/components/portal/invoices"
import { ExpensesView } from "@/components/portal/expenses"
import { ClientsView } from "@/components/portal/clients"
import { ReportsView } from "@/components/portal/reports"
import { TeamView } from "@/components/portal/team"
import { AuditView } from "@/components/portal/audit"
import { SettingsView } from "@/components/portal/settings"

export default function Home() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <App />
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            borderRadius: "14px",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 12px 32px -12px rgba(0,0,0,0.18)",
            fontSize: "13.5px",
          },
        }}
      />
    </ThemeProvider>
  )
}

function App() {
  const [booting, setBooting] = useState(true)
  const [me, setMe] = useState<Me | null>(null)
  const [view, setView] = useState<ViewId>("dashboard")
  const [badgeTick, setBadgeTick] = useState(0)

  const fetchMe = useCallback(async (): Promise<Me | null> => {
    try {
      return await api<Me>("/api/auth/me")
    } catch {
      return null
    }
  }, [])

  const refreshMe = useCallback(async () => {
    const data = await fetchMe()
    setMe(data)
    return data
  }, [fetchMe])

  useEffect(() => {
    let active = true
    void fetchMe().then((data) => {
      if (!active) return
      setMe(data)
      setBooting(false)
    })
    return () => {
      active = false
    }
  }, [fetchMe])

  const onMutation = useCallback(() => {
    setBadgeTick((t) => t + 1)
  }, [])

  // Guard: if the current view isn't permitted after a role change, land on dashboard.
  const effectiveView = useMemo<ViewId>(() => {
    if (!me) return "dashboard"
    const cap = me.capabilities
    const allowed: Record<ViewId, boolean> = {
      dashboard: true,
      transactions: cap.canManageFinance,
      invoices: cap.canManageFinance,
      expenses: true,
      clients: cap.canManageFinance,
      reports: cap.canManageFinance,
      team: cap.canManageUsers,
      audit: cap.canViewAudit,
      settings: true,
    }
    return allowed[view] ? view : "dashboard"
  }, [me, view])

  const companyValue = useMemo(
    () => ({
      currency: me?.company?.currency ?? "INR",
      companyName: me?.company?.companyName ?? "My Company",
    }),
    [me]
  )

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-13 w-13 items-center justify-center rounded-[14px] bg-gradient-to-b from-[#0a84ff] to-[#0071e3] shadow-lg shadow-[#0071e3]/25" style={{ height: 52, width: 52 }}>
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </div>
          <p className="text-[13px] text-muted-foreground">Opening your ledger…</p>
        </div>
      </div>
    )
  }

  if (!me) {
    return <LoginScreen onLoggedIn={() => void refreshMe()} />
  }

  return (
    <CompanyContext.Provider value={companyValue}>
      <PortalShell
        me={me}
        view={effectiveView}
        setView={setView}
        onLogout={() => {
          setMe(null)
          setView("dashboard")
        }}
        badgeTick={badgeTick}
      >
        {effectiveView === "dashboard" && <DashboardView me={me} onMutation={onMutation} />}
        {effectiveView === "transactions" && <TransactionsView me={me} onMutation={onMutation} />}
        {effectiveView === "invoices" && <InvoicesView me={me} onMutation={onMutation} />}
        {effectiveView === "expenses" && <ExpensesView me={me} onMutation={onMutation} />}
        {effectiveView === "clients" && <ClientsView me={me} onMutation={onMutation} />}
        {effectiveView === "reports" && <ReportsView />}
        {effectiveView === "team" && <TeamView me={me} onMutation={onMutation} />}
        {effectiveView === "audit" && <AuditView />}
        {effectiveView === "settings" && <SettingsView me={me} onProfileSaved={() => void refreshMe()} />}
      </PortalShell>
    </CompanyContext.Provider>
  )
}

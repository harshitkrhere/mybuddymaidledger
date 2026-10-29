"use client"

// ============================================================
// Shell — frosted sidebar, sticky glass top bar, view routing.
// Navigation is derived from the role's module access.
// ============================================================

import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useTheme } from "next-themes"
import {
  ArrowLeftRight,
  BarChart3,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Moon,
  ScrollText,
  Settings as SettingsIcon,
  Sun,
  UserCog,
  Users as UsersIcon,
  Wallet,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { api, RoleBadge, useApi, type Me, type ViewId } from "./shared"

type NavItem = { id: ViewId; label: string; icon: typeof LayoutDashboard; group: string; badge?: number }

export const APPLE_EASE = [0.32, 0.72, 0, 1] as const

export function PortalShell({
  me,
  view,
  setView,
  onLogout,
  badgeTick,
  children,
}: {
  me: Me
  view: ViewId
  setView: (v: ViewId) => void
  onLogout: () => void
  badgeTick: number
  children: React.ReactNode
}) {
  const { theme, setTheme } = useTheme()
  const { data: badgeData } = useApi<{ pendingCount: number }>(`/api/expenses?status=PENDING&badge=1&_=${badgeTick}`)

  const nav = useMemo(() => {
    const items: NavItem[] = []
    const cap = me.capabilities
    const add = (id: ViewId, label: string, icon: typeof LayoutDashboard, group: string) =>
      items.push({ id, label, icon, group })

    add("dashboard", "Dashboard", LayoutDashboard, "Workspace")
    if (cap.canManageFinance) {
      add("transactions", "Transactions", ArrowLeftRight, "Finance")
      add("invoices", "Invoices", FileText, "Finance")
    }
    add("expenses", "Expenses", Wallet, "Finance")
    if (cap.canManageFinance) {
      add("clients", "Clients & Vendors", UsersIcon, "Finance")
      add("reports", "Reports", BarChart3, "Insights")
    }
    if (cap.canManageUsers) {
      add("team", "Team & Roles", UserCog, "Governance")
      add("audit", "Audit Log", ScrollText, "Governance")
    }
    add("settings", "Settings", SettingsIcon, "")
    return items
  }, [me.capabilities])

  const groups = useMemo(() => {
    const seen: string[] = []
    for (const item of nav) if (item.group && !seen.includes(item.group)) seen.push(item.group)
    return seen
  }, [nav])

  const current = nav.find((n) => n.id === view)
  const pending = badgeData?.pendingCount ?? 0

  const initials = me.user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  async function logout() {
    try {
      await api("/api/auth/logout", "POST")
    } catch {
      // ignore — we're leaving anyway
    }
    toast("Signed out")
    onLogout()
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-b from-[#0a84ff] to-[#0071e3] text-[15px] font-bold text-white shadow-md shadow-[#0071e3]/25">
          L
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-tight tracking-tight">Ledger</p>
          <p className="truncate text-[11px] text-muted-foreground">{me.company?.companyName ?? "Accounting & Finance"}</p>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="mt-2 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {groups.map((group) => (
          <div key={group}>
            <p className="micro-label mb-1.5 px-2.5">{group}</p>
            <div className="space-y-0.5">
              {nav
                .filter((n) => n.group === group)
                .map((item) => (
                  <NavButton
                    key={item.id}
                    item={item}
                    active={view === item.id}
                    pending={item.id === "expenses" ? pending : 0}
                    onClick={() => setView(item.id)}
                  />
                ))}
            </div>
          </div>
        ))}

        {/* Settings pinned near the bottom */}
        <div className="pt-2">
          <div className="space-y-0.5">
            {nav
              .filter((n) => !n.group)
              .map((item) => (
                <NavButton
                  key={item.id}
                  item={item}
                  active={view === item.id}
                  pending={0}
                  onClick={() => setView(item.id)}
                />
              ))}
          </div>
        </div>
      </nav>

      {/* User card */}
      <div className="border-t border-border/60 px-4 py-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border border-black/5 dark:border-white/10">
            <AvatarFallback className="bg-primary/10 text-[13px] font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight">{me.user.name}</p>
            <div className="mt-0.5"><RoleBadge role={me.user.role} /></div>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="press flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="glass fixed inset-y-0 left-0 z-40 hidden w-[248px] border-r border-black/6 dark:border-white/8 lg:block">
        {sidebar}
      </aside>

      {/* Main column */}
      <div className="lg:pl-[248px]">
        {/* Top bar */}
        <header className="glass sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-black/6 px-4 dark:border-white/8 sm:px-6">
          <MobileNavTrigger nav={nav} view={view} setView={setView} pending={pending} sidebar={sidebar} />

          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <span className="hidden sm:inline">{current?.group === "Governance" ? "Governance" : current?.group || "Workspace"}</span>
            <ChevronRight className="hidden h-3.5 w-3.5 sm:inline" />
            <span className="font-semibold text-foreground">{current?.label ?? "Dashboard"}</span>
            {view === "expenses" && pending > 0 && (
              <span className="ml-1 rounded-full bg-orange-500/12 px-2 py-0.5 text-[11px] font-semibold text-orange-600 ring-1 ring-inset ring-orange-500/25 dark:text-orange-400">
                {pending} pending
              </span>
            )}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title="Toggle appearance"
              className="press flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={theme ?? "system"}
                  initial={{ opacity: 0, rotate: -30, scale: 0.8 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 30, scale: 0.8 }}
                  transition={{ duration: 0.25, ease: APPLE_EASE }}
                  className="flex"
                >
                  {theme === "dark" ? <Sun className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} /> : <Moon style={{ width: 18, height: 18 }} className="h-4.5 w-4.5" />}
                </motion.span>
              </AnimatePresence>
            </button>

            {/* User menu (desktop) */}
            <div className="hidden lg:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="press flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2.5 hover:bg-accent">
                    <Avatar className="h-8 w-8 border border-black/5 dark:border-white/10">
                      <AvatarFallback className="bg-primary/10 text-[12px] font-semibold text-primary">{initials}</AvatarFallback>
                    </Avatar>
                    <span className="text-[13px] font-medium">{me.user.name.split(" ")[0]}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl">
                  <DropdownMenuLabel className="pb-1.5">
                    <p className="text-[13px] font-semibold">{me.user.name}</p>
                    <p className="mt-0.5 text-[11px] font-normal text-muted-foreground">{me.user.email}</p>
                    <div className="mt-1.5"><RoleBadge role={me.user.role} /></div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setView("settings")} className="gap-2 rounded-lg text-[13px]">
                    <SettingsIcon className="h-4 w-4" /> Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout} className="gap-2 rounded-lg text-[13px] text-red-600 focus:text-red-600 dark:text-red-400">
                    <LogOut className="h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* View content — roomy bottom padding on mobile (safe-area aware) */}
        <main className="mx-auto w-full max-w-[1200px] px-4 pt-7 pb-[max(5.5rem,calc(env(safe-area-inset-bottom)+4rem))] sm:px-6 sm:pb-16 lg:px-8 lg:pb-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.32, ease: APPLE_EASE }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

function NavButton({
  item,
  active,
  pending,
  onClick,
}: {
  item: NavItem
  active: boolean
  pending: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "press relative flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-[13.5px] font-medium",
        active
          ? "bg-primary/10 text-primary"
          : "text-foreground/75 hover:bg-accent hover:text-foreground"
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-pill"
          transition={{ duration: 0.35, ease: APPLE_EASE }}
          className="absolute inset-0 rounded-[10px] bg-primary/10"
        />
      )}
      <item.icon className={cn("relative h-[17px] w-[17px]", active ? "text-primary" : "text-muted-foreground")} strokeWidth={2} />
      <span className="relative flex-1 text-left">{item.label}</span>
      {pending > 0 && (
        <span className="relative rounded-full bg-orange-500 px-1.5 py-px text-[10px] font-bold text-white">{pending}</span>
      )}
    </button>
  )
}

function MobileNavTrigger({
  nav,
  view,
  setView,
  pending,
  sidebar,
}: {
  nav: NavItem[]
  view: ViewId
  setView: (v: ViewId) => void
  pending: number
  sidebar: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 lg:hidden">
      <MobileSheet nav={nav} view={view} setView={setView} pending={pending} sidebar={sidebar} />
    </div>
  )
}

function MobileSheet({
  nav,
  view,
  setView,
  pending,
  sidebar,
}: {
  nav: NavItem[]
  view: ViewId
  setView: (v: ViewId) => void
  pending: number
  sidebar: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  void nav
  void view
  void pending

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="press flex h-9 w-9 items-center justify-center rounded-full text-foreground hover:bg-accent"
        title="Menu"
      >
        <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} fill="currentColor">
          <rect x="1" y="4" width="18" height="1.7" rx="0.85" />
          <rect x="1" y="9.2" width="18" height="1.7" rx="0.85" />
          <rect x="1" y="14.4" width="12" height="1.7" rx="0.85" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-50 bg-black/25 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.38, ease: APPLE_EASE }}
              className="glass fixed inset-y-0 left-0 z-50 w-[270px] border-r border-black/8 bg-background/85 dark:border-white/10"
            >
              <button
                onClick={() => setOpen(false)}
                className="press absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
              <div onClick={() => setOpen(false)}>{sidebar}</div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

"use client"

// ============================================================
// Team & Roles — Red/Admin only.
// Admins manage Managers and Employees; only Red can grant or
// revoke Admin. Every rule is also enforced server-side.
// ============================================================

import { useMemo, useState } from "react"
import {
  Check,
  KeyRound,
  Power,
  ShieldAlert,
  UserPlus,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import {
  api,
  ErrorNote,
  fmtDate,
  PageHeader,
  Pill,
  RoleBadge,
  TableSkeleton,
  useApi,
  type Me,
  type Role,
  type TeamUser,
} from "./shared"
import { EmptyState } from "./shared"

type ListResponse = { users: TeamUser[]; assignableRoles: Role[] }

const ALL_ROLES: Role[] = ["RED", "ADMIN", "MANAGER", "EMPLOYEE"]

export function TeamView({ me, onMutation }: { me: Me; onMutation: () => void }) {
  const { data, loading, error, reload } = useApi<ListResponse>("/api/users")
  const [adding, setAdding] = useState(false)
  const [resetting, setResetting] = useState<TeamUser | null>(null)
  const [deactivating, setDeactivating] = useState<TeamUser | null>(null)
  const [roleChanging, setRoleChanging] = useState<string | null>(null)

  const isRed = me.user.role === "RED"

  const counts = useMemo(() => {
    const map = new Map<Role, number>()
    for (const u of data?.users ?? []) map.set(u.role, (map.get(u.role) ?? 0) + 1)
    return map
  }, [data])

  // Roles the actor may move a given target to (mirrors server rules).
  function nextRolesFor(target: TeamUser): Role[] {
    if (target.id === me.user.id) return []
    if (isRed) return ALL_ROLES.filter((r) => r !== target.role)
    if (me.user.role === "ADMIN" && (target.role === "MANAGER" || target.role === "EMPLOYEE")) {
      return ["MANAGER", "EMPLOYEE"].filter((r) => r !== target.role)
    }
    return []
  }

  async function changeRole(target: TeamUser, next: Role) {
    setRoleChanging(target.id)
    try {
      await api(`/api/users/${target.id}`, "PATCH", { action: "setRole", role: next })
      toast.success(`${target.name} is now ${next === "RED" ? "Red" : next.charAt(0) + next.slice(1).toLowerCase()}`)
      await reload()
      onMutation()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change role.")
    } finally {
      setRoleChanging(null)
    }
  }

  async function toggleStatus(target: TeamUser) {
    try {
      await api(`/api/users/${target.id}`, "PATCH", { action: "setStatus", status: target.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })
      toast.success(target.status === "ACTIVE" ? `${target.name} deactivated` : `${target.name} reactivated`)
      await reload()
      onMutation()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update.")
    }
  }

  const canToggle = (u: TeamUser) =>
    u.id !== me.user.id && (isRed || u.role === "MANAGER" || u.role === "EMPLOYEE")

  const canReset = (u: TeamUser) =>
    u.id !== me.user.id && (isRed || u.role === "MANAGER" || u.role === "EMPLOYEE")

  return (
    <div>
      <PageHeader title="Team & Roles" subtitle="Access follows the hierarchy: Red → Admin → Manager → Employee.">
        <Button onClick={() => setAdding(true)} className="press h-10 rounded-full px-5 gap-1.5 shadow-md shadow-primary/25">
          <UserPlus className="h-4 w-4" /> Add member
        </Button>
      </PageHeader>

      {/* Hierarchy explainer */}
      <div className="card-shadow mb-5 flex items-start gap-3 rounded-2xl border bg-card p-4">
        <ShieldAlert className={cn("mt-0.5 h-5 w-5 shrink-0", isRed ? "text-red-500" : "text-primary")} />
        <div className="text-[13px] leading-relaxed">
          {isRed ? (
            <>
              <p className="font-semibold">You hold the keys.</p>
              <p className="text-muted-foreground">
                Only Red can assign or revoke Admins, change any role, and edit company settings. Admins you appoint can manage Managers and Employees — never other Admins.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold">You manage Managers and Employees.</p>
              <p className="text-muted-foreground">
                You can add members as Manager or Employee and switch between those two roles. Granting Admin is reserved for Red.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Role summary */}
      <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        {ALL_ROLES.map((r) => (
          <div key={r} className="card-shadow flex items-center justify-between rounded-2xl border bg-card px-5 py-3.5">
            <RoleBadge role={r} />
            <span className="num text-[19px] font-semibold">{counts.get(r) ?? 0}</span>
          </div>
        ))}
      </div>

      {/* User table */}
      <div className="card-shadow overflow-hidden rounded-2xl border bg-card">
        {error && <ErrorNote message={error} />}
        {loading && !data ? (
          <TableSkeleton rows={6} />
        ) : !data ? null : data.users.length === 0 ? (
          <EmptyState icon={UserPlus} title="No members yet" description="Add your first team member." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="micro-label px-5 py-3 font-semibold">Member</th>
                  <th className="micro-label px-3 py-3 font-semibold">Role</th>
                  <th className="micro-label px-3 py-3 font-semibold">Change role</th>
                  <th className="micro-label px-3 py-3 font-semibold">Status</th>
                  <th className="micro-label hidden px-3 py-3 font-semibold md:table-cell">Joined</th>
                  <th className="micro-label px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {data.users.map((u) => {
                  const isSelf = u.id === me.user.id
                  const nextRoles = nextRolesFor(u)
                  const inactive = u.status !== "ACTIVE"
                  return (
                    <tr key={u.id} className={cn("transition-colors hover:bg-accent/50", inactive && "opacity-60")}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border border-black/5 dark:border-white/10">
                            <AvatarFallback className={cn("text-[12px] font-semibold", u.role === "RED" ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-primary/10 text-primary")}>
                              {u.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 font-semibold leading-tight">
                              {u.name}
                              {isSelf && <span className="rounded-full bg-muted px-2 py-px text-[10px] font-semibold text-muted-foreground">You</span>}
                            </p>
                            <p className="truncate text-[12px] text-muted-foreground">{u.email}{u.title ? ` · ${u.title}` : ""}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <RoleBadge role={u.role} />
                        {u.pendingExpenses > 0 && (
                          <p className="mt-1 text-[11px] text-orange-600 dark:text-orange-400">{u.pendingExpenses} pending expense{u.pendingExpenses > 1 ? "s" : ""}</p>
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        {isSelf ? (
                          <span className="text-[12px] text-muted-foreground">—</span>
                        ) : nextRoles.length === 0 ? (
                          <Pill tone="gray">Locked</Pill>
                        ) : (
                          <Select
                            value={u.role}
                            onValueChange={(v) => changeRole(u, v as Role)}
                            disabled={roleChanging === u.id}
                          >
                            <SelectTrigger className="h-8 w-[132px] rounded-lg bg-muted/40 border-transparent text-[12.5px] font-medium">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {nextRoles.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {r === "RED" ? "Red" : r.charAt(0) + r.slice(1).toLowerCase()}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        <Switch
                          checked={u.status === "ACTIVE"}
                          disabled={!canToggle(u)}
                          onCheckedChange={() => (u.status === "ACTIVE" ? setDeactivating(u) : toggleStatus(u))}
                          aria-label="Toggle active"
                        />
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-3.5 text-muted-foreground md:table-cell">{fmtDate(u.createdAt)}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right">
                        <button
                          onClick={() => setResetting(u)}
                          disabled={!canReset(u)}
                          title={canReset(u) ? "Reset password" : "Not allowed for this role"}
                          className="press ml-1 rounded-lg p-1.5 text-muted-foreground enabled:hover:bg-accent enabled:hover:text-foreground disabled:opacity-30"
                        >
                          <KeyRound className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add member */}
      {adding && data && (
        <AddMemberDialog
          assignable={data.assignableRoles}
          isRed={isRed}
          onClose={() => setAdding(false)}
          onSaved={async () => {
            setAdding(false)
            await reload()
            onMutation()
          }}
        />
      )}

      {/* Reset password */}
      {resetting && (
        <ResetPasswordDialog
          user={resetting}
          onClose={() => setResetting(null)}
          onSaved={() => setResetting(null)}
        />
      )}

      {/* Deactivate confirm */}
      <AlertDialog open={!!deactivating} onOpenChange={(o) => !o && setDeactivating(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {deactivating?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivating?.name} will be signed out immediately and unable to sign in until reactivated. Their records stay intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="press rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deactivating && toggleStatus(deactivating)}
              className="press rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Power className="h-4 w-4" /> Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============================================================
// Add member — role options strictly follow the hierarchy
// ============================================================

function AddMemberDialog({
  assignable,
  isRed,
  onClose,
  onSaved,
}: {
  assignable: Role[]
  isRed: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [title, setTitle] = useState("")
  const [role, setRole] = useState<Role>(assignable[0] ?? "EMPLOYEE")

  async function save() {
    if (password !== confirm) {
      toast.error("The passwords don't match.")
      return
    }
    setBusy(true)
    try {
      await api("/api/users", "POST", { name, email, password, role, title })
      toast.success(`${name} added as ${role === "RED" ? "Red" : role.charAt(0) + role.slice(1).toLowerCase()}`)
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add member.")
      setBusy(false)
    }
  }

  const roleHint: Record<Role, string> = {
    RED: "Absolute control — including assigning Admins.",
    ADMIN: "Runs the portal; manages Managers and Employees only.",
    MANAGER: "Full financial visibility and expense approvals.",
    EMPLOYEE: "Self-service — submits own expenses.",
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[440px] rounded-[20px] p-6">
        <DialogHeader>
          <DialogTitle className="tracking-tight">Add a team member</DialogTitle>
          <DialogDescription>
            There is no signup — this is how accounts are created.
            {!isRed && " You can add Managers and Employees."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label className="text-[13px]">Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ananya Rao" className="h-10 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px]">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@mybuddymaid.com" className="h-10 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" className="h-10 rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Confirm</Label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" className="h-10 rounded-lg" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px]">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>
                {assignable.map((r) => (
                  <SelectItem key={r} value={r}>{r === "RED" ? "Red" : r.charAt(0) + r.slice(1).toLowerCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[12px] leading-snug text-muted-foreground">{roleHint[role]}</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px]">Job title <span className="text-muted-foreground">(optional)</span></Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Finance Manager" className="h-10 rounded-lg" />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="outline" onClick={onClose} className="press h-10 rounded-full px-5">Cancel</Button>
          <Button onClick={save} disabled={busy || !name.trim() || !email.trim() || password.length < 8} className="press h-10 rounded-full px-6">
            {busy ? "Adding…" : "Add member"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Reset password
// ============================================================

function ResetPasswordDialog({ user, onClose, onSaved }: { user: TeamUser; onClose: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState(false)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")

  async function save() {
    if (password !== confirm) {
      toast.error("The passwords don't match.")
      return
    }
    setBusy(true)
    try {
      await api(`/api/users/${user.id}`, "PATCH", { action: "resetPassword", password })
      toast.success(`Password reset for ${user.name}. They'll need to sign in again.`)
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reset.")
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[400px] rounded-[20px] p-6">
        <DialogHeader>
          <DialogTitle className="tracking-tight">Reset password</DialogTitle>
          <DialogDescription>
            Set a new password for {user.name} ({user.email}). They will be signed out of all devices.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label className="text-[13px]">New password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" className="h-10 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px]">Confirm</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" className="h-10 rounded-lg" />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="outline" onClick={onClose} className="press h-10 rounded-full px-5">Cancel</Button>
          <Button onClick={save} disabled={busy || password.length < 8 || password !== confirm} className="press h-10 rounded-full px-6 gap-1.5">
            {busy ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />} Reset password
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

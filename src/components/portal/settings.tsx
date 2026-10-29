"use client"

// ============================================================
// Settings — profile & password for everyone; company
// settings for Red only (enforced server-side too).
// ============================================================

import { useState } from "react"
import { Building2, Check, KeyRound, Loader2, User } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { api, fmtDate, PageHeader, RoleBadge, useApi, type Me } from "./shared"

type SettingsResponse = {
  profile: { name: string; email: string; role: string; title: string | null; createdAt?: string }
  company: {
    id: string
    companyName: string
    currency: string
    taxRate: number
    email: string | null
    phone: string | null
    address: string | null
  } | null
  canEditCompany: boolean
}

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD"]

export function SettingsView({ me, onProfileSaved }: { me: Me; onProfileSaved: () => void }) {
  const { data, loading, reload } = useApi<SettingsResponse>("/api/settings")

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your account, your password, and the company profile." />

      {loading && !data ? (
        <div className="space-y-6">
          <div className="card-shadow h-[220px] rounded-2xl border bg-card animate-pulse" />
          <div className="card-shadow h-[240px] rounded-2xl border bg-card animate-pulse" />
          <div className="card-shadow h-[300px] rounded-2xl border bg-card animate-pulse" />
        </div>
      ) : !data ? null : (
        <div className="space-y-6">
          <ProfileCard data={data} onSaved={reload} onProfileSaved={onProfileSaved} />
          <PasswordCard />
          {data.canEditCompany ? (
            <CompanyCard data={data} onSaved={reload} />
          ) : (
            <CompanyReadonlyCard data={data} />
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Profile
// ============================================================

function ProfileCard({ data, onSaved, onProfileSaved }: { data: SettingsResponse; onSaved: () => void; onProfileSaved: () => void }) {
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState(data.profile.name)
  const [title, setTitle] = useState(data.profile.title ?? "")

  async function save() {
    setBusy(true)
    try {
      await api("/api/settings", "PATCH", { action: "profile", name, title })
      toast.success("Profile updated")
      onSaved()
      onProfileSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.")
    } finally {
      setBusy(false)
    }
  }

  const dirty = name !== data.profile.name || title !== (data.profile.title ?? "")

  return (
    <section className="card-shadow rounded-2xl border bg-card p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <User className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
        </span>
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight">Profile</h2>
          <p className="text-[13px] text-muted-foreground">How you appear across the portal.</p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-[13px]">Full name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-10 rounded-lg" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[13px]">Job title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Senior Accountant" className="h-10 rounded-lg" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[13px]">Email</Label>
          <Input value={data.profile.email} disabled className="h-10 rounded-lg opacity-60" />
          <p className="text-[11.5px] text-muted-foreground">Email is fixed — it's your sign-in identity.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[13px]">Role</Label>
          <div className="flex h-10 items-center gap-2.5">
            <RoleBadge role={data.profile.role} />
            {data.profile.createdAt && (
              <span className="text-[12px] text-muted-foreground">since {fmtDate(data.profile.createdAt)}</span>
            )}
          </div>
          <p className="text-[11.5px] text-muted-foreground">Roles are granted by Red or an Admin.</p>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <Button onClick={save} disabled={busy || !dirty || !name.trim()} className="press h-10 rounded-full px-6 gap-1.5">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save profile
        </Button>
      </div>
    </section>
  )
}

// ============================================================
// Password
// ============================================================

function PasswordCard() {
  const [busy, setBusy] = useState(false)
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")

  async function save() {
    if (next !== confirm) {
      toast.error("The new passwords don't match.")
      return
    }
    setBusy(true)
    try {
      await api("/api/settings", "PATCH", { action: "password", currentPassword: current, newPassword: next })
      toast.success("Password changed")
      setCurrent("")
      setNext("")
      setConfirm("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change password.")
    } finally {
      setBusy(false)
    }
  }

  const ready = current && next.length >= 8 && next === confirm

  return (
    <section className="card-shadow rounded-2xl border bg-card p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
          <KeyRound className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
        </span>
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight">Password</h2>
          <p className="text-[13px] text-muted-foreground">Choose a strong one — at least 8 characters.</p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-[13px]">Current password</Label>
          <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className="h-10 rounded-lg" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[13px]">New password</Label>
          <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} className="h-10 rounded-lg" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[13px]">Confirm new password</Label>
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-10 rounded-lg" />
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <Button onClick={save} disabled={busy || !ready} className="press h-10 rounded-full px-6 gap-1.5">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Change password
        </Button>
      </div>
    </section>
  )
}

// ============================================================
// Company (Red editable)
// ============================================================

function CompanyCard({ data, onSaved }: { data: SettingsResponse; onSaved: () => void }) {
  const [busy, setBusy] = useState(false)
  const c = data.company
  const [companyName, setCompanyName] = useState(c?.companyName ?? "")
  const [currency, setCurrency] = useState(c?.currency ?? "INR")
  const [taxRate, setTaxRate] = useState(String(c?.taxRate ?? 18))
  const [email, setEmail] = useState(c?.email ?? "")
  const [phone, setPhone] = useState(c?.phone ?? "")
  const [address, setAddress] = useState(c?.address ?? "")

  async function save() {
    setBusy(true)
    try {
      await api("/api/settings", "PATCH", {
        action: "company",
        companyName,
        currency,
        taxRate: Number(taxRate) || 0,
        email,
        phone,
        address,
      })
      toast.success("Company settings saved")
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.")
    } finally {
      setBusy(false)
    }
  }

  const dirty =
    companyName !== (c?.companyName ?? "") ||
    currency !== (c?.currency ?? "INR") ||
    taxRate !== String(c?.taxRate ?? 18) ||
    email !== (c?.email ?? "") ||
    phone !== (c?.phone ?? "") ||
    address !== (c?.address ?? "")

  return (
    <section className="card-shadow rounded-2xl border bg-card p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
          <Building2 className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
        </span>
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight">Company</h2>
          <p className="text-[13px] text-muted-foreground">Only Red can edit these.</p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-[13px]">Company name</Label>
          <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="h-10 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[13px]">Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((cu) => (
                  <SelectItem key={cu} value={cu}>{cu}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px]">Default tax %</Label>
            <Input type="number" min="0" max="100" step="0.5" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="h-10 rounded-lg num" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[13px]">Billing email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10 rounded-lg" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[13px]">Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-10 rounded-lg" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-[13px]">Address</Label>
          <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="rounded-lg" />
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <Button onClick={save} disabled={busy || !dirty} className="press h-10 rounded-full px-6 gap-1.5">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save company settings
        </Button>
      </div>
    </section>
  )
}

function CompanyReadonlyCard({ data }: { data: SettingsResponse }) {
  const c = data.company
  return (
    <section className="card-shadow rounded-2xl border bg-card p-6 opacity-90">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Building2 className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
        </span>
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight">Company</h2>
          <p className="text-[13px] text-muted-foreground">Read-only — Red manages company settings.</p>
        </div>
      </div>
      <dl className="grid gap-x-8 gap-y-3 text-[13.5px] sm:grid-cols-2">
        <Readonly label="Company name" value={c?.companyName ?? "—"} />
        <Readonly label="Currency" value={c?.currency ?? "INR"} />
        <Readonly label="Default tax" value={`${c?.taxRate ?? 18}%`} />
        <Readonly label="Billing email" value={c?.email ?? "—"} />
        <Readonly label="Phone" value={c?.phone ?? "—"} />
        <Readonly label="Address" value={c?.address ?? "—"} />
      </dl>
    </section>
  )
}

function Readonly({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-[60%] truncate font-medium">{value}</dd>
    </div>
  )
}

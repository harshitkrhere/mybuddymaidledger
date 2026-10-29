"use client"

// ============================================================
// Login — the only public surface of the portal.
// No signup exists; accounts are granted by Red/Admin.
// ============================================================

import { useState } from "react"
import { motion } from "framer-motion"
import { AtSign, KeyRound, Loader2, Lock, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { api } from "./shared"

export function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await api("/api/auth/login", "POST", { email, password })
      toast.success("Welcome back.")
      onLoggedIn()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in right now.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f5f5f7] px-4 py-10 dark:bg-[#1c1c1e]">
      {/* Ambient light — soft Apple-style gradient blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-[#0071e3]/12 blur-3xl dark:bg-[#0a84ff]/10" />
        <div className="absolute -bottom-48 -left-24 h-[420px] w-[520px] rounded-full bg-[#af52de]/10 blur-3xl dark:bg-[#bf5af2]/10" />
        <div className="absolute -right-32 top-1/3 h-[380px] w-[420px] rounded-full bg-[#34c759]/10 blur-3xl dark:bg-[#30d158]/8" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
        className="relative w-full max-w-[400px]"
      >
        {/* Glass card */}
        <div className="glass card-shadow rounded-[24px] border border-black/8 p-8 dark:border-white/10">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-13 w-13 items-center justify-center rounded-[14px] bg-gradient-to-b from-[#0a84ff] to-[#0071e3] shadow-lg shadow-[#0071e3]/25" style={{ height: 52, width: 52 }}>
              <Lock className="h-6 w-6 text-white" strokeWidth={2.2} />
            </div>
            <h1 className="mt-5 text-[22px] font-semibold tracking-tight">Ledger</h1>
            <p className="mt-1 text-[14px] text-muted-foreground">Internal accounting &amp; finance portal</p>
          </div>

          <form onSubmit={submit} className="mt-7 space-y-3.5">
            <label className="block">
              <span className="sr-only">Email</span>
              <div className="group relative">
                <AtSign className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="h-11 w-full rounded-xl border border-black/10 bg-white/70 pl-10 pr-4 text-[15px] outline-none transition-all duration-300 placeholder:text-muted-foreground/70 focus:border-primary/60 focus:bg-white focus:ring-4 focus:ring-primary/15 dark:border-white/10 dark:bg-white/5 dark:focus:bg-white/10"
                />
              </div>
            </label>

            <label className="block">
              <span className="sr-only">Password</span>
              <div className="group relative">
                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="h-11 w-full rounded-xl border border-black/10 bg-white/70 pl-10 pr-4 text-[15px] outline-none transition-all duration-300 placeholder:text-muted-foreground/70 focus:border-primary/60 focus:bg-white focus:ring-4 focus:ring-primary/15 dark:border-white/10 dark:bg-white/5 dark:focus:bg-white/10"
                />
              </div>
            </label>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl bg-red-500/8 px-3.5 py-2.5 text-[13px] font-medium text-red-600 ring-1 ring-inset ring-red-500/20 dark:text-red-400"
                role="alert"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="press flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground shadow-md shadow-primary/25 transition-all hover:brightness-110 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Invite-only · accounts are granted by an administrator
          </p>
        </div>
      </motion.div>
    </div>
  )
}

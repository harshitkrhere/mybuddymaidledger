'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, ListTree, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { fmtMoney, AccountTypeBadge, LoadingBlock, ErrorNote, FadeIn, Card, TH, TH_R } from './shared';
import { cn } from '@/lib/utils';

interface AccountRow {
  id: string;
  code: string;
  name: string;
  type: string;
  subtype: string | null;
  isActive: boolean;
  debitTotal: number;
  creditTotal: number;
  balance: number;
}

const TYPE_ORDER = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
const TYPE_LABELS: Record<string, string> = {
  ASSET: 'Assets',
  LIABILITY: 'Liabilities',
  EQUITY: 'Equity',
  REVENUE: 'Revenue',
  EXPENSE: 'Expenses',
};

export function ChartOfAccounts() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', type: 'ASSET', subtype: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      setError('');
      const res = await fetch('/api/accounts');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setAccounts(json.accounts);
    } catch {
      setError('Could not load accounts. Please refresh.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!accounts) return [];
    return accounts.filter((a) => {
      if (typeFilter !== 'ALL' && a.type !== typeFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        return a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
      }
      return true;
    });
  }, [accounts, query, typeFilter]);

  const grouped = useMemo(() => {
    const g: Record<string, AccountRow[]> = {};
    for (const a of filtered) {
      (g[a.type] = g[a.type] || []).push(a);
    }
    return g;
  }, [filtered]);

  const totals = useMemo(() => {
    if (!accounts) return null;
    const t: Record<string, number> = {};
    for (const a of accounts) {
      if (!a.isActive) continue;
      t[a.type] = (t[a.type] || 0) + a.balance;
    }
    return t;
  }, [accounts]);

  const createAccount = async () => {
    if (!form.code.trim() || !form.name.trim() || !form.type) {
      toast({ title: 'Please fill in code, name and type.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code.trim(),
          name: form.name.trim(),
          type: form.type,
          subtype: form.subtype.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create account');
      toast({ title: `Account ${form.code} created` });
      setDialogOpen(false);
      setForm({ code: '', name: '', type: 'ASSET', subtype: '' });
      await load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Failed to create account', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (account: AccountRow) => {
    try {
      const res = await fetch(`/api/accounts/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !account.isActive }),
      });
      if (!res.ok) throw new Error();
      toast({ title: `${account.name} ${account.isActive ? 'deactivated' : 'reactivated'}` });
      await load();
    } catch {
      toast({ title: 'Failed to update account', variant: 'destructive' });
    }
  };

  if (error) return <ErrorNote message={error} />;
  if (!accounts) return <LoadingBlock label="Loading chart of accounts…" />;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <FadeIn delay={0.05}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.9} />
              <Input
                placeholder="Search by code or name…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="sm:w-44">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All types</SelectItem>
                {TYPE_ORDER.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="shrink-0">
            <Plus className="h-4 w-4" /> New Account
          </Button>
        </div>
      </FadeIn>

      {/* Account groups */}
      <div className="space-y-5">
        {TYPE_ORDER.map((type, gi) => {
          const rows = grouped[type] || [];
          if (rows.length === 0) return null;
          return (
            <FadeIn key={type} delay={0.05 + gi * 0.05}>
              <Card className="overflow-hidden py-0">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-4">
                  <div className="flex items-center gap-2.5">
                    <AccountTypeBadge type={type} />
                    <h2 className="text-[16px] font-semibold tracking-[-0.01em]">{TYPE_LABELS[type]}</h2>
                    <span className="text-[12.5px] text-muted-foreground">{rows.length} accounts</span>
                  </div>
                  {totals && <p className="num text-[15px] font-bold">{fmtMoney(totals[type] || 0)}</p>}
                </div>
                <p className="px-5 pb-3 text-[12.5px] text-muted-foreground">
                  {type === 'ASSET' && 'What the business owns — balances increase with debits'}
                  {type === 'LIABILITY' && 'What the business owes — balances increase with credits'}
                  {type === 'EQUITY' && "Owners' stake in the business"}
                  {type === 'REVENUE' && 'Income earned from operations'}
                  {type === 'EXPENSE' && 'Costs incurred to run the business'}
                </p>
                <div className="thin-scroll overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-black/[0.06]">
                        <th scope="col" className={TH}>Code</th>
                        <th scope="col" className={TH}>Account</th>
                        <th scope="col" className={cn(TH_R, 'hidden md:table-cell')}>Debits</th>
                        <th scope="col" className={cn(TH_R, 'hidden md:table-cell')}>Credits</th>
                        <th scope="col" className={TH_R}>Balance</th>
                        <th scope="col" className="px-5 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((a) => (
                        <tr
                          key={a.id}
                          className={cn(
                            'border-b border-black/[0.045] transition-colors last:border-0 hover:bg-black/[0.015]',
                            !a.isActive && 'opacity-55'
                          )}
                        >
                          <td className="num px-4 py-3 text-[13px] text-muted-foreground">{a.code}</td>
                          <td className="px-4 py-3">
                            <span className={cn('text-[14px] font-medium', !a.isActive && 'line-through')}>{a.name}</span>
                            {a.subtype && (
                              <span className="ml-2 text-[12px] text-muted-foreground">
                                {a.subtype.replaceAll('_', ' ').toLowerCase()}
                              </span>
                            )}
                          </td>
                          <td className="num hidden px-4 py-3 text-right text-[13px] text-muted-foreground md:table-cell">
                            {a.debitTotal ? fmtMoney(a.debitTotal) : '—'}
                          </td>
                          <td className="num hidden px-4 py-3 text-right text-[13px] text-muted-foreground md:table-cell">
                            {a.creditTotal ? fmtMoney(a.creditTotal) : '—'}
                          </td>
                          <td
                            className={cn(
                              'num px-4 py-3 text-right text-[14px] font-semibold',
                              a.balance < 0 && 'text-[#FF3B30]'
                            )}
                          >
                            {fmtMoney(a.balance)}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <Switch
                              checked={a.isActive}
                              onCheckedChange={() => toggleActive(a)}
                              aria-label={`Toggle ${a.name}`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </FadeIn>
          );
        })}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 rounded-[20px] border border-dashed border-black/[0.1] py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/[0.04]">
              <ListTree className="h-6 w-6 text-muted-foreground" strokeWidth={1.6} />
            </span>
            <p className="text-[15px] font-semibold">No accounts match your filters</p>
            <p className="text-[13px] text-muted-foreground">Try clearing the search or type filter.</p>
          </div>
        )}
      </div>

      {/* New account dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Account</DialogTitle>
            <DialogDescription>Add a new account to the chart of accounts.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1 space-y-1.5">
                <Label htmlFor="acc-code">Code</Label>
                <Input
                  id="acc-code"
                  placeholder="5950"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="acc-name">Name</Label>
                <Input
                  id="acc-name"
                  placeholder="Training & Courses"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_ORDER.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-subtype">Subtype (optional)</Label>
              <Input
                id="acc-subtype"
                placeholder="OPERATING"
                value={form.subtype}
                onChange={(e) => setForm({ ...form, subtype: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createAccount} disabled={submitting}>
              {submitting ? 'Creating…' : 'Create Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

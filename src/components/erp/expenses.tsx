'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Receipt, Search } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { fmtMoney, fmtDate, LoadingBlock, ErrorNote, FadeIn, Card, TH, TH_R } from './shared';
import { cn } from '@/lib/utils';

interface ExpenseRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  paymentMode: string;
  vendor: string | null;
}

const PAYMENT_MODES = [
  { value: 'UPI', label: 'UPI' },
  { value: 'BANK', label: 'Bank transfer' },
  { value: 'CARD', label: 'Credit/debit card' },
  { value: 'CASH', label: 'Cash' },
];

export function Expenses() {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<ExpenseRow[] | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [query, setQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: '',
    amount: '',
    category: 'Marketing',
    paymentMode: 'UPI',
    vendor: '',
  });

  const load = async () => {
    try {
      setError('');
      const res = await fetch('/api/expenses?limit=200');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setExpenses(json.expenses);
      setCategories(json.categories ?? []);
    } catch {
      setError('Could not load expenses. Please refresh.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!expenses) return [];
    return expenses.filter((e) => {
      if (categoryFilter !== 'ALL' && e.category !== categoryFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        return (
          e.description.toLowerCase().includes(q) ||
          (e.vendor || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [expenses, categoryFilter, query]);

  const total = useMemo(
    () => filtered.reduce((s, e) => s + e.amount, 0),
    [filtered]
  );

  const submit = async () => {
    const amount = parseFloat(form.amount);
    if (!form.date || !form.description.trim() || !amount || amount <= 0) {
      toast({ title: 'Date, description and a positive amount are required.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to record expense');
      toast({
        title: 'Expense recorded',
        description: 'Journal entry auto-posted (expense debit, payment account credit).',
      });
      setDialogOpen(false);
      setForm({ ...form, description: '', amount: '', vendor: '' });
      await load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Failed to record expense', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (expense: ExpenseRow) => {
    try {
      const res = await fetch(`/api/expenses?id=${expense.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast({ title: 'Expense deleted' });
      await load();
    } catch {
      toast({ title: 'Failed to delete expense', variant: 'destructive' });
    }
  };

  if (error) return <ErrorNote message={error} />;
  if (!expenses) return <LoadingBlock label="Loading expenses…" />;

  return (
    <div className="space-y-5">
      <FadeIn delay={0.05}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.9} />
              <Input
                placeholder="Search description or vendor…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="shrink-0">
            <Plus className="h-4 w-4" /> Record Expense
          </Button>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <Card className="overflow-hidden py-0">
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[0.06]">
                  <th scope="col" className={TH}>Date</th>
                  <th scope="col" className={TH}>Description</th>
                  <th scope="col" className={cn(TH, 'hidden sm:table-cell')}>Vendor</th>
                  <th scope="col" className={TH}>Category</th>
                  <th scope="col" className={cn(TH, 'hidden md:table-cell')}>Paid via</th>
                  <th scope="col" className={TH_R}>Amount</th>
                  <th scope="col" className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="group border-b border-black/[0.045] transition-colors last:border-0 hover:bg-black/[0.015]">
                    <td className="num whitespace-nowrap px-4 py-3.5 text-[13px] text-muted-foreground">{fmtDate(e.date)}</td>
                    <td className="max-w-64 truncate px-4 py-3.5 text-[14px] font-medium">{e.description}</td>
                    <td className="hidden px-4 py-3.5 text-[13px] text-muted-foreground sm:table-cell">{e.vendor || '—'}</td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center whitespace-nowrap rounded-full bg-[#FF9500]/12 px-2.5 py-[3px] text-[11.5px] font-semibold text-[#C77C00]">
                        {e.category}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3.5 text-[13px] text-muted-foreground md:table-cell">
                      {PAYMENT_MODES.find((p) => p.value === e.paymentMode)?.label || e.paymentMode}
                    </td>
                    <td className="num px-4 py-3.5 text-right text-[14px] font-semibold text-[#C77C00]">
                      −{fmtMoney(e.amount)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-[#FF3B30]/[0.07] hover:text-[#FF3B30] group-hover:opacity-100"
                        onClick={() => remove(e)}
                        aria-label="Delete expense"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.9} />
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-14 text-center">
                      <Receipt className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" strokeWidth={1.6} />
                      <p className="text-[14px] font-semibold">No expenses found</p>
                      <p className="mt-0.5 text-[12.5px] text-muted-foreground">Try clearing the search or filters.</p>
                    </td>
                  </tr>
                )}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-black/[0.08]">
                    <td className="px-4 py-3.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-muted-foreground" colSpan={5}>
                      Total ({filtered.length} expenses)
                    </td>
                    <td className="num px-4 py-3.5 text-right text-[15px] font-bold text-[#C77C00]">−{fmtMoney(total)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      </FadeIn>

      {/* record expense dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Expense</DialogTitle>
            <DialogDescription>The matching journal entry is posted automatically.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="exp-date">Date</Label>
                <Input
                  id="exp-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exp-amount">Amount</Label>
                <Input
                  id="exp-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="num text-right"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-desc">Description</Label>
              <Input
                id="exp-desc"
                placeholder="e.g. LinkedIn ads campaign"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Paid via</Label>
                <Select value={form.paymentMode} onValueChange={(v) => setForm({ ...form, paymentMode: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-vendor">Vendor (optional)</Label>
              <Input
                id="exp-vendor"
                placeholder="e.g. Google Ads"
                value={form.vendor}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? 'Saving…' : 'Save Expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

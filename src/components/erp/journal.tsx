'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, BookOpen, Trash2, ChevronDown } from 'lucide-react';
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
import { fmtMoney, fmtDate, SourceBadge, LoadingBlock, ErrorNote, FadeIn, Card, EASE_APPLE } from './shared';
import { cn } from '@/lib/utils';

interface JournalLineRow {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
  memo: string | null;
}

interface JournalEntryRow {
  id: string;
  entryNumber: string;
  date: string;
  memo: string;
  reference: string | null;
  source: string;
  isPosted: boolean;
  lines: JournalLineRow[];
  totalDebit: number;
}

interface AccountOption {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface DraftLine {
  key: number;
  accountId: string;
  debit: string;
  credit: string;
  memo: string;
}

export function Journal() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<JournalEntryRow[] | null>(null);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), memo: '', reference: '' });
  const [lines, setLines] = useState<DraftLine[]>([
    { key: 1, accountId: '', debit: '', credit: '', memo: '' },
    { key: 2, accountId: '', debit: '', credit: '', memo: '' },
  ]);
  const [lineSeq, setLineSeq] = useState(3);

  const load = async () => {
    try {
      setError('');
      const [entryRes, accRes] = await Promise.all([fetch('/api/journal'), fetch('/api/accounts')]);
      if (!entryRes.ok || !accRes.ok) throw new Error();
      const entryJson = await entryRes.json();
      const accJson = await accRes.json();
      setEntries(entryJson.entries);
      setAccounts(
        (accJson.accounts as (AccountOption & { isActive: boolean })[]).filter((a) => a.isActive)
      );
    } catch {
      setError('Could not load journal entries. Please refresh.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    const debit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const credit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    return {
      debit: Math.round(debit * 100) / 100,
      credit: Math.round(credit * 100) / 100,
      balanced: Math.abs(debit - credit) < 0.005 && debit > 0,
    };
  }, [lines]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addLine = () => {
    setLines((prev) => [...prev, { key: lineSeq, accountId: '', debit: '', credit: '', memo: '' }]);
    setLineSeq((s) => s + 1);
  };

  const removeLine = (key: number) => {
    setLines((prev) => (prev.length <= 2 ? prev : prev.filter((l) => l.key !== key)));
  };

  const updateLine = (key: number, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const submit = async () => {
    const validLines = lines
      .filter((l) => l.accountId && ((parseFloat(l.debit) || 0) > 0 || (parseFloat(l.credit) || 0) > 0))
      .map((l) => ({
        accountId: l.accountId,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
        memo: l.memo || null,
      }));

    if (!form.date || !form.memo.trim()) {
      toast({ title: 'Date and memo are required.', variant: 'destructive' });
      return;
    }
    if (validLines.length < 2) {
      toast({ title: 'At least two lines with amounts are required.', variant: 'destructive' });
      return;
    }
    if (!totals.balanced) {
      toast({ title: 'Entry is not balanced — debits must equal credits.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: form.date,
          memo: form.memo.trim(),
          reference: form.reference.trim() || null,
          lines: validLines,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create entry');
      toast({ title: `Journal entry ${json.entry.entryNumber} posted` });
      setDialogOpen(false);
      setForm({ date: new Date().toISOString().slice(0, 10), memo: '', reference: '' });
      setLines([
        { key: lineSeq, accountId: '', debit: '', credit: '', memo: '' },
        { key: lineSeq + 1, accountId: '', debit: '', credit: '', memo: '' },
      ]);
      setLineSeq((s) => s + 2);
      await load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Failed to create entry', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (error) return <ErrorNote message={error} />;
  if (!entries) return <LoadingBlock label="Loading journal…" />;

  return (
    <div className="space-y-5">
      <FadeIn delay={0.05}>
        <div className="flex items-center justify-between px-1">
          <p className="text-[13px] text-muted-foreground">
            {entries.length} entries · general ledger · newest first
          </p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> New Entry
          </Button>
        </div>
      </FadeIn>

      <div className="space-y-2.5">
        {entries.map((e, i) => {
          const isOpen = expanded.has(e.id);
          return (
            <FadeIn key={e.id} delay={0.03 + Math.min(i * 0.025, 0.25)} y={8}>
              <Card className="overflow-hidden py-0">
                <button
                  onClick={() => toggleExpanded(e.id)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-black/[0.015] sm:px-5"
                  aria-expanded={isOpen}
                >
                  <motion.span animate={{ rotate: isOpen ? 0 : -90 }} transition={{ duration: 0.3, ease: EASE_APPLE }} className="shrink-0">
                    <ChevronDown className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
                  </motion.span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium leading-tight">{e.memo}</p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {fmtDate(e.date)} · {e.entryNumber}
                      {e.reference ? ` · ref ${e.reference}` : ''}
                    </p>
                  </div>
                  <span className="hidden sm:block">
                    <SourceBadge source={e.source} />
                  </span>
                  <p className="num w-24 shrink-0 text-right text-[14px] font-semibold sm:w-32">
                    {fmtMoney(e.totalDebit)}
                  </p>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.32, ease: EASE_APPLE }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-black/[0.06] bg-black/[0.015] px-4 py-3.5 sm:px-5">
                        <div className="thin-scroll overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                                <th className="py-1.5 pr-4">Account</th>
                                <th className="hidden py-1.5 pr-4 md:table-cell">Line memo</th>
                                <th className="py-1.5 text-right">Debit</th>
                                <th className="py-1.5 pl-4 text-right">Credit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {e.lines.map((l) => (
                                <tr key={l.id} className="border-t border-black/[0.05]">
                                  <td className="py-2.5 pr-4">
                                    <span className="num text-[12px] text-muted-foreground">{l.accountCode}</span>{' '}
                                    <span className="text-[13.5px] font-medium">{l.accountName}</span>
                                  </td>
                                  <td className="hidden py-2.5 pr-4 text-[13px] text-muted-foreground md:table-cell">
                                    {l.memo || '—'}
                                  </td>
                                  <td className="num py-2.5 text-right text-[13px]">
                                    {l.debit ? fmtMoney(l.debit) : ''}
                                  </td>
                                  <td className="num py-2.5 pl-4 text-right text-[13px]">
                                    {l.credit ? fmtMoney(l.credit) : ''}
                                  </td>
                                </tr>
                              ))}
                              <tr className="border-t-2 border-black/[0.08] font-semibold">
                                <td className="py-2.5 pr-4 text-[12px] uppercase tracking-[0.05em] text-muted-foreground" colSpan={2}>
                                  Totals
                                </td>
                                <td className="num py-2.5 text-right text-[13.5px]">{fmtMoney(e.totalDebit)}</td>
                                <td className="num py-2.5 pl-4 text-right text-[13.5px]">{fmtMoney(e.totalDebit)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </FadeIn>
          );
        })}
        {entries.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 rounded-[20px] border border-dashed border-black/[0.1] py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/[0.04]">
              <BookOpen className="h-6 w-6 text-muted-foreground" strokeWidth={1.6} />
            </span>
            <p className="text-[15px] font-semibold">No journal entries yet</p>
            <p className="text-[13px] text-muted-foreground">Post your first entry to start the ledger.</p>
          </div>
        )}
      </div>

      {/* New entry dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Journal Entry</DialogTitle>
            <DialogDescription>Record a double-entry transaction. Debits must equal credits.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="je-date">Date</Label>
              <Input
                id="je-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="je-memo">Memo</Label>
              <Input
                id="je-memo"
                placeholder="e.g. Monthly depreciation"
                value={form.memo}
                onChange={(e) => setForm({ ...form, memo: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="je-ref">Reference (optional)</Label>
            <Input
              id="je-ref"
              placeholder="e.g. INV-2026-0007"
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
            />
          </div>

          <div className="space-y-2.5">
            <Label>Lines</Label>
            <div className="space-y-2.5">
              {lines.map((l, idx) => (
                <div
                  key={l.key}
                  className="grid grid-cols-12 items-center gap-2 rounded-[14px] border border-black/[0.07] bg-black/[0.02] p-2.5"
                >
                  <div className="col-span-12 space-y-1 sm:col-span-5">
                    <Select value={l.accountId} onValueChange={(v) => updateLine(l.key, { accountId: v })}>
                      <SelectTrigger size="sm" className="w-full">
                        <SelectValue placeholder={`Account ${idx + 1}`} />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.code} · {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-5 sm:col-span-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Debit"
                      className="num h-9 rounded-[10px] text-right text-[13px]"
                      value={l.debit}
                      onChange={(e) =>
                        updateLine(l.key, {
                          debit: e.target.value,
                          credit: e.target.value ? '' : l.credit,
                        })
                      }
                    />
                  </div>
                  <div className="col-span-5 sm:col-span-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Credit"
                      className="num h-9 rounded-[10px] text-right text-[13px]"
                      value={l.credit}
                      onChange={(e) =>
                        updateLine(l.key, {
                          credit: e.target.value,
                          debit: e.target.value ? '' : l.debit,
                        })
                      }
                    />
                  </div>
                  <div className="col-span-2 flex justify-end sm:col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => removeLine(l.key)}
                      disabled={lines.length <= 2}
                      aria-label="Remove line"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.9} />
                    </Button>
                  </div>
                  <div className="col-span-12 sm:col-span-11">
                    <Input
                      placeholder="Line memo (optional)"
                      className="h-9 rounded-[10px] text-[13px]"
                      value={l.memo}
                      onChange={(e) => updateLine(l.key, { memo: e.target.value })}
                    />
                  </div>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-3.5 w-3.5" /> Add line
            </Button>
          </div>

          <div
            className={cn(
              'flex items-center justify-between rounded-[14px] px-4 py-3 text-[13.5px]',
              totals.balanced ? 'bg-[#34C759]/[0.1] text-[#248A3D]' : 'bg-[#FF9500]/[0.1] text-[#C77C00]'
            )}
          >
            <span className="font-semibold">
              {totals.balanced ? '✓ Balanced' : 'Not balanced'}
            </span>
            <span className="num">
              Dr {fmtMoney(totals.debit)} · Cr {fmtMoney(totals.credit)}
              <span className="ml-2 font-semibold">
                {totals.balanced ? '' : `Δ ${fmtMoney(Math.abs(totals.debit - totals.credit))}`}
              </span>
            </span>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting || !totals.balanced}>
              {submitting ? 'Posting…' : 'Post Entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

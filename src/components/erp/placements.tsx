'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Home, RotateCcw, Square, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { fmtMoney, fmtDate, PlacementStatusBadge, LoadingBlock, ErrorNote, Avatar, FadeIn } from './shared';
import { SegmentedControl } from './shell';
import { cn } from '@/lib/utils';

interface PlacementRow {
  id: string;
  customerId: string;
  helperId: string;
  customer: {
    id: string;
    name: string;
    city: string;
    locality: string | null;
    phone: string | null;
    planType: string | null;
    maxPlacements: number;
    placementsUsed: number;
  };
  helper: { id: string; name: string; phone: string | null; city: string; serviceType: string };
  serviceType: string;
  startDate: string;
  endDate: string | null;
  status: string;
  isReplacement: boolean;
  monthlyRate: number | null;
  notes: string | null;
}

interface CustomerOption {
  id: string;
  name: string;
  city: string;
  planType: string | null;
  status: string;
  placementsUsed: number;
  maxPlacements: number;
  daysLeft: number | null;
}

interface HelperOption {
  id: string;
  name: string;
  city: string;
  serviceType: string;
  status: string;
}

const SERVICE_TYPES: [string, string][] = [
  ['FULL_TIME_MAID', 'Full-Time Maid'],
  ['PART_TIME_MAID', 'Part-Time Maid'],
  ['COOK', 'Cook'],
  ['BABYSITTER', 'Babysitter / Nanny'],
  ['ELDER_CARE', 'Elder Care'],
  ['DOMESTIC_HELP', 'Domestic Help'],
];

export function Placements() {
  const { toast } = useToast();
  const [placements, setPlacements] = useState<PlacementRow[] | null>(null);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [helpers, setHelpers] = useState<HelperOption[]>([]);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<PlacementRow | null>(null);
  const [newHelperId, setNewHelperId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [form, setForm] = useState({
    customerId: '',
    helperId: '',
    serviceType: 'FULL_TIME_MAID',
    startDate: new Date().toISOString().slice(0, 10),
    monthlyRate: '',
    notes: '',
  });

  const load = async () => {
    try {
      setError('');
      const [pRes, cRes, hRes] = await Promise.all([
        fetch('/api/placements'),
        fetch('/api/customers'),
        fetch('/api/helpers'),
      ]);
      if (!pRes.ok || !cRes.ok || !hRes.ok) throw new Error();
      const pJson = await pRes.json();
      const cJson = await cRes.json();
      const hJson = await hRes.json();
      setPlacements(pJson.placements);
      setCustomers(cJson.customers);
      setHelpers(hJson.helpers);
    } catch {
      setError('Could not load placements. Please refresh.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!placements) return [];
    return tab === 'ALL' ? placements : placements.filter((p) => p.status === tab);
  }, [placements, tab]);

  const eligibleCustomers = useMemo(
    () =>
      customers.filter(
        (c) => c.planType && c.status === 'ACTIVE' && (c.daysLeft == null || c.daysLeft > 0)
      ),
    [customers]
  );

  const availableHelpers = useMemo(
    () =>
      helpers.filter(
        (h) =>
          h.status === 'VERIFIED' &&
          (!replaceTarget ? true : h.serviceType === replaceTarget.serviceType)
      ),
    [helpers, replaceTarget]
  );

  const submit = async () => {
    if (!form.customerId || !form.helperId) {
      toast({ title: 'Select a customer and a helper.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/placements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: form.customerId,
          helperId: form.helperId,
          serviceType: form.serviceType,
          startDate: form.startDate,
          monthlyRate: form.monthlyRate ? parseFloat(form.monthlyRate) : null,
          notes: form.notes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create placement');
      toast({
        title: 'Placement created',
        description: 'Helper marked as placed. Monthly pay goes directly to the helper.',
      });
      setCreateOpen(false);
      setForm({ ...form, customerId: '', helperId: '', monthlyRate: '', notes: '' });
      await load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Failed to create placement', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const act = async (placement: PlacementRow, action: 'end' | 'replace') => {
    if (action === 'replace') {
      setReplaceTarget(placement);
      setNewHelperId('');
      return;
    }
    setBusyId(placement.id);
    try {
      const res = await fetch('/api/placements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: placement.id, action: 'end' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to end placement');
      toast({ title: 'Placement ended', description: 'Helper is available again.' });
      await load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Failed to end placement', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const doReplace = async () => {
    if (!replaceTarget || !newHelperId) {
      toast({ title: 'Select a replacement helper.', variant: 'destructive' });
      return;
    }
    setBusyId(replaceTarget.id);
    try {
      const res = await fetch('/api/placements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: replaceTarget.id, action: 'replace', newHelperId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to replace');
      toast({
        title: 'Replacement placed',
        description: 'Old helper released · new helper placed under the same plan.',
      });
      setReplaceTarget(null);
      setNewHelperId('');
      await load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Failed to replace', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  if (error) return <ErrorNote message={error} />;
  if (!placements) return <LoadingBlock label="Loading placements…" />;

  const serviceLabel = (t: string) => SERVICE_TYPES.find(([k]) => k === t)?.[1] || t;
  const activeCount = placements.filter((p) => p.status === 'ACTIVE').length;

  return (
    <div className="space-y-5">
      <FadeIn delay={0.05}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedControl
            options={[
              { value: 'ALL', label: 'All' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'REPLACED', label: 'Replaced' },
              { value: 'ENDED', label: 'Ended' },
            ]}
            value={tab}
            onChange={setTab}
          />
          <div className="flex items-center gap-4">
            <p className="hidden text-[13px] text-muted-foreground sm:block">
              {activeCount} active · {placements.length} total
            </p>
            <Button onClick={() => setCreateOpen(true)} className="shrink-0">
              <Plus className="h-4 w-4" /> New Placement
            </Button>
          </div>
        </div>
      </FadeIn>

      <div className="space-y-3">
        {filtered.map((p, i) => (
          <FadeIn key={p.id} delay={0.03 + Math.min(i * 0.04, 0.3)} y={10}>
            <div className="card-shadow rounded-[20px] border border-black/[0.06] bg-card p-4 transition-shadow hover:card-shadow-hover sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                {/* connection: customer ⇄ helper */}
                <div className="flex min-w-0 flex-1 items-center gap-3.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={p.customer.name} size={40} />
                    <div className="hidden min-w-0 sm:block">
                      <p className="truncate text-[14px] font-semibold leading-tight">{p.customer.name}</p>
                      <p className="text-[11.5px] text-muted-foreground">Household</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-center gap-0.5">
                    <span
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full',
                        p.status === 'ACTIVE' ? 'bg-[#34C759]/12 text-[#248A3D]' : 'bg-black/[0.05] text-muted-foreground'
                      )}
                    >
                      <Home className="h-3.5 w-3.5" strokeWidth={1.9} />
                    </span>
                    <span className="h-[2px] w-8 rounded-full bg-black/[0.08]" aria-hidden="true" />
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={p.helper.name} size={40} />
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold leading-tight">{p.helper.name}</p>
                      <p className="text-[11.5px] text-muted-foreground">{serviceLabel(p.serviceType)}</p>
                    </div>
                  </div>
                </div>

                <div className="min-w-0 flex-1 border-t border-black/[0.05] pt-3 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <PlacementStatusBadge status={p.status} />
                    {p.isReplacement && (
                      <span className="rounded-full bg-[#FF9500]/12 px-2.5 py-[3px] text-[11.5px] font-semibold text-[#C77C00]">
                        Replacement
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                    {p.customer.locality ? `${p.customer.locality}, ` : ''}
                    {p.customer.city} · from {fmtDate(p.startDate)}
                    {p.endDate ? ` · ended ${fmtDate(p.endDate)}` : ''}
                  </p>
                  <p className="num mt-0.5 text-[12.5px] text-muted-foreground">
                    {p.monthlyRate ? `${fmtMoney(p.monthlyRate, { compact: true })}/mo · direct to helper · ` : ''}
                    {p.customer.placementsUsed}/{p.customer.maxPlacements} plan placements used
                  </p>
                </div>

                {p.status === 'ACTIVE' && (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === p.id}
                      onClick={() => act(p, 'end')}
                    >
                      <Square className="h-3 w-3" /> End
                    </Button>
                    <Button size="sm" disabled={busyId === p.id} onClick={() => act(p, 'replace')}>
                      <RotateCcw className="h-3.5 w-3.5" /> Replace
                    </Button>
                  </div>
                )}
              </div>
              {p.notes && (
                <p className="mt-3 rounded-[12px] bg-black/[0.03] p-3 text-[12px] leading-relaxed text-muted-foreground">{p.notes}</p>
              )}
            </div>
          </FadeIn>
        ))}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 rounded-[20px] border border-dashed border-black/[0.1] py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/[0.04]">
              <Home className="h-6 w-6 text-muted-foreground" strokeWidth={1.6} />
            </span>
            <p className="text-[15px] font-semibold">No {tab.toLowerCase() !== 'all' ? tab.toLowerCase() : ''} placements</p>
            <p className="text-[13px] text-muted-foreground">Create a placement to connect a family with a helper.</p>
          </div>
        )}
      </div>

      {/* create placement dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Placement</DialogTitle>
            <DialogDescription>
              Connect a verified helper with a customer under an active plan. Helper pay goes directly to the
              helper — no book entry needed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Customer (active plan required)</Label>
              <Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select customer…" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {eligibleCustomers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} — {c.city} ({c.placementsUsed}/{c.maxPlacements} used)
                    </SelectItem>
                  ))}
                  {eligibleCustomers.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      No customers with active plans — record a plan sale first.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Service type</Label>
                <Select value={form.serviceType} onValueChange={(v) => setForm({ ...form, serviceType: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-rate">Monthly rate (₹, direct)</Label>
                <Input
                  id="p-rate"
                  type="number"
                  min="0"
                  step="500"
                  placeholder="16000"
                  value={form.monthlyRate}
                  onChange={(e) => setForm({ ...form, monthlyRate: e.target.value })}
                  className="num text-right"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Helper (verified &amp; available)</Label>
              <Select value={form.helperId} onValueChange={(v) => setForm({ ...form, helperId: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select helper…" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {helpers
                    .filter((h) => h.status === 'VERIFIED')
                    .map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.name} — {h.city} · {serviceLabel(h.serviceType)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p-date">Start date</Label>
              <Input
                id="p-date"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p-notes">Notes</Label>
              <Textarea
                id="p-notes"
                placeholder="Interview outcome, agreed terms…"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? 'Creating…' : 'Create Placement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* replace helper dialog */}
      <Dialog open={!!replaceTarget} onOpenChange={(o) => !o && setReplaceTarget(null)}>
        <DialogContent className="sm:max-w-md">
          {replaceTarget && (
            <>
              <DialogHeader>
                <DialogTitle>Replace Helper</DialogTitle>
                <DialogDescription>
                  {replaceTarget.customer.name} · {serviceLabel(replaceTarget.serviceType)} · currently{' '}
                  {replaceTarget.helper.name}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-[14px] bg-black/[0.03] p-3.5 text-[14px]">
                  <Avatar name={replaceTarget.helper.name} size={34} />
                  <span className="font-semibold">{replaceTarget.helper.name}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-[#0071E3]">New helper</span>
                </div>
                <div className="space-y-1.5">
                  <Label>Replacement helper (verified &amp; available)</Label>
                  <Select value={newHelperId} onValueChange={setNewHelperId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select replacement…" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {availableHelpers.map((h) => (
                        <SelectItem key={h.id} value={h.id}>
                          {h.name} — {h.city} · {serviceLabel(h.serviceType)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                  The replacement counts as one placement against the plan ({replaceTarget.customer.placementsUsed}/
                  {replaceTarget.customer.maxPlacements} used).
                </p>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setReplaceTarget(null)}>
                  Cancel
                </Button>
                <Button onClick={doReplace} disabled={busyId === replaceTarget.id || !newHelperId}>
                  {busyId === replaceTarget.id ? 'Replacing…' : 'Place Replacement'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

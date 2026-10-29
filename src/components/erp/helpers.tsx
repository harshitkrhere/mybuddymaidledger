'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapPin, Phone, Trash2, BadgeCheck, ShieldAlert, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { fmtMoney, HelperStatusBadge, LoadingBlock, ErrorNote, Avatar, FadeIn } from './shared';
import { cn } from '@/lib/utils';

interface HelperRow {
  id: string;
  name: string;
  phone: string | null;
  gender: string;
  city: string;
  locality: string | null;
  serviceType: string;
  expectedMonthlyRate: number | null;
  aadhaarVerified: boolean;
  policeVerified: boolean;
  referenceChecked: boolean;
  status: string;
  notes: string | null;
  placementCount: number;
  activePlacement: boolean;
}

const CITIES = ['Delhi', 'Gurgaon', 'Noida', 'Greater Noida', 'Mumbai', 'Pune', 'Bangalore', 'Mangalore'];
const SERVICE_TYPES: [string, string][] = [
  ['FULL_TIME_MAID', 'Full-Time Maid'],
  ['PART_TIME_MAID', 'Part-Time Maid'],
  ['COOK', 'Cook'],
  ['BABYSITTER', 'Babysitter / Nanny'],
  ['ELDER_CARE', 'Elder Care'],
  ['DOMESTIC_HELP', 'Domestic Help'],
];

export function Helpers() {
  const { toast } = useToast();
  const [helpers, setHelpers] = useState<HelperRow[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [serviceFilter, setServiceFilter] = useState('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    gender: 'F',
    city: 'Delhi',
    locality: '',
    serviceType: 'FULL_TIME_MAID',
    expectedMonthlyRate: '',
    aadhaarVerified: false,
    policeVerified: false,
    referenceChecked: false,
    notes: '',
  });

  const load = async () => {
    try {
      setError('');
      const res = await fetch('/api/helpers');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setHelpers(json.helpers);
    } catch {
      setError('Could not load helpers. Please refresh.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!helpers) return [];
    return helpers.filter((h) => {
      if (statusFilter !== 'ALL' && h.status !== statusFilter) return false;
      if (serviceFilter !== 'ALL' && h.serviceType !== serviceFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        return (
          h.name.toLowerCase().includes(q) ||
          h.city.toLowerCase().includes(q) ||
          (h.locality || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [helpers, query, statusFilter, serviceFilter]);

  const submit = async () => {
    if (!form.name.trim() || !form.city || !form.serviceType) {
      toast({ title: 'Name, city and service type are required.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/helpers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          expectedMonthlyRate: form.expectedMonthlyRate ? parseFloat(form.expectedMonthlyRate) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to add helper');
      toast({
        title: `Helper "${form.name}" added`,
        description:
          form.aadhaarVerified && form.policeVerified && form.referenceChecked
            ? 'Fully verified — ready for placement.'
            : 'Pending verification — complete Aadhaar, police & reference checks.',
      });
      setDialogOpen(false);
      setForm({
        name: '',
        phone: '',
        gender: 'F',
        city: 'Delhi',
        locality: '',
        serviceType: 'FULL_TIME_MAID',
        expectedMonthlyRate: '',
        aadhaarVerified: false,
        policeVerified: false,
        referenceChecked: false,
        notes: '',
      });
      await load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Failed to add helper', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCheck = async (h: HelperRow, field: 'aadhaarVerified' | 'policeVerified' | 'referenceChecked') => {
    try {
      const res = await fetch('/api/helpers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: h.id, [field]: !h[field] }),
      });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      toast({ title: 'Failed to update verification', variant: 'destructive' });
    }
  };

  const remove = async (h: HelperRow) => {
    try {
      const res = await fetch(`/api/helpers?id=${h.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete');
      toast({ title: `Helper "${h.name}" removed` });
      await load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Failed to delete helper', variant: 'destructive' });
    }
  };

  if (error) return <ErrorNote message={error} />;
  if (!helpers) return <LoadingBlock label="Loading helpers…" />;

  const serviceLabel = (t: string) => SERVICE_TYPES.find(([k]) => k === t)?.[1] || t;

  return (
    <div className="space-y-5">
      <FadeIn delay={0.05}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              placeholder="Search name, city or locality…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 sm:max-w-xs"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="sm:w-38">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="VERIFIED">Verified</SelectItem>
                <SelectItem value="PLACED">Placed</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger className="sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All services</SelectItem>
                {SERVICE_TYPES.map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="shrink-0">
            <Plus className="h-4 w-4" /> Add Helper
          </Button>
        </div>
      </FadeIn>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((h, i) => {
          const fullyVerified = h.aadhaarVerified && h.policeVerified && h.referenceChecked;
          return (
            <FadeIn key={h.id} delay={0.03 + Math.min(i * 0.03, 0.24)} y={10}>
              <div className="press card-shadow group flex h-full flex-col rounded-[20px] border border-black/[0.06] bg-card p-5 transition-shadow hover:card-shadow-hover">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Avatar name={h.name} size={42} />
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold leading-tight tracking-[-0.01em]">{h.name}</p>
                      <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                        {serviceLabel(h.serviceType)}
                        {h.expectedMonthlyRate ? ` · ${fmtMoney(h.expectedMonthlyRate, { compact: true })}/mo` : ''}
                      </p>
                    </div>
                  </div>
                  <HelperStatusBadge status={h.status} />
                </div>

                <div className="mt-3.5 space-y-1 text-[13px] text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
                    {h.locality ? `${h.locality}, ` : ''}
                    {h.city}
                  </p>
                  {h.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} /> {h.phone}
                    </p>
                  )}
                </div>

                {/* verification checklist — iOS settings rows with switches */}
                <div className="mt-4 space-y-0 border-t border-black/[0.05] pt-2">
                  {(
                    [
                      ['aadhaarVerified', 'Aadhaar verified', h.aadhaarVerified],
                      ['policeVerified', 'Police verification', h.policeVerified],
                      ['referenceChecked', 'References checked', h.referenceChecked],
                    ] as const
                  ).map(([field, label, checked]) => (
                    <label
                      key={field}
                      className="flex cursor-pointer items-center justify-between gap-2 rounded-[8px] py-[7px] text-[13.5px] hover:bg-black/[0.02]"
                      onClick={(e) => {
                        e.preventDefault();
                        if (h.status !== 'PLACED') toggleCheck(h, field);
                      }}
                    >
                      <span className={cn(checked ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
                      <Switch checked={checked} disabled={h.status === 'PLACED'} className="pointer-events-none scale-90" />
                    </label>
                  ))}
                  <div className="flex items-center gap-1.5 pb-1 pt-1.5 text-[12px]">
                    {fullyVerified ? (
                      <span className="flex items-center gap-1 font-medium text-[#248A3D]">
                        <BadgeCheck className="h-3.5 w-3.5" strokeWidth={1.9} /> Fully verified
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 font-medium text-[#C77C00]">
                        <ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.9} /> Verification pending
                      </span>
                    )}
                    <span className="ml-auto text-muted-foreground">
                      {h.placementCount > 0 ? `${h.placementCount} placement${h.placementCount > 1 ? 's' : ''}` : 'No placements'}
                    </span>
                  </div>
                </div>

                {h.notes && (
                  <p className="mt-2.5 rounded-[12px] bg-black/[0.03] p-3 text-[12px] leading-relaxed text-muted-foreground">{h.notes}</p>
                )}

                {h.placementCount === 0 && (
                  <div className="mt-auto pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 rounded-full px-2.5 text-[12px] text-muted-foreground opacity-0 transition-opacity hover:bg-[#FF3B30]/[0.07] hover:text-[#FF3B30] group-hover:opacity-100"
                      onClick={() => remove(h)}
                      aria-label="Delete helper"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                )}
              </div>
            </FadeIn>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center gap-2 rounded-[20px] border border-dashed border-black/[0.1] py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/[0.04]">
              <BadgeCheck className="h-6 w-6 text-muted-foreground" strokeWidth={1.6} />
            </span>
            <p className="text-[15px] font-semibold">No helpers found</p>
            <p className="text-[13px] text-muted-foreground">Try clearing the search or filters.</p>
          </div>
        )}
      </div>

      {/* add helper dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Helper</DialogTitle>
            <DialogDescription>Register a domestic helper and track verification.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="h-name">Name *</Label>
                <Input
                  id="h-name"
                  placeholder="Sunita Devi"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="h-phone">Phone</Label>
                <Input
                  id="h-phone"
                  placeholder="+91 7xxxxxxxx"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>City *</Label>
                <Select value={form.city} onValueChange={(v) => setForm({ ...form, city: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CITIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="h-locality">Locality</Label>
                <Input
                  id="h-locality"
                  placeholder="Hauz Khas"
                  value={form.locality}
                  onChange={(e) => setForm({ ...form, locality: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Service *</Label>
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
                <Label htmlFor="h-rate">Expected rate (₹/mo)</Label>
                <Input
                  id="h-rate"
                  type="number"
                  min="0"
                  step="500"
                  placeholder="16000"
                  value={form.expectedMonthlyRate}
                  onChange={(e) => setForm({ ...form, expectedMonthlyRate: e.target.value })}
                  className="num text-right"
                />
              </div>
            </div>

            <div className="space-y-1 rounded-[14px] bg-black/[0.03] p-1">
              <p className="px-3 pt-2 pb-1 text-[12px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Verification status
              </p>
              {(
                [
                  ['aadhaarVerified', 'Aadhaar identity validated'],
                  ['policeVerified', 'Police verification / court clearance'],
                  ['referenceChecked', 'Previous employer references checked'],
                ] as const
              ).map(([field, label]) => (
                <label key={field} className="flex cursor-pointer items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-[13.5px] hover:bg-black/[0.02]">
                  <span>{label}</span>
                  <Switch checked={form[field]} onCheckedChange={(v) => setForm({ ...form, [field]: !!v })} />
                </label>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="h-notes">Notes</Label>
              <Textarea
                id="h-notes"
                placeholder="Skills, languages, experience…"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? 'Adding…' : 'Add Helper'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

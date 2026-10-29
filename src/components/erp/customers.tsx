'use client';

import { useEffect, useMemo, useState } from 'react';
import { Phone, Mail, Trash2, Users, ShieldCheck, Plus } from 'lucide-react';
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
import { fmtMoney, fmtDate, PlanBadge, CustomerStatusBadge, LoadingBlock, ErrorNote, Avatar, FadeIn } from './shared';
import { cn } from '@/lib/utils';

interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string;
  locality: string | null;
  notes: string | null;
  planType: string | null;
  planFee: number | null;
  planPurchaseDate: string | null;
  planExpiryDate: string | null;
  placementsUsed: number;
  maxPlacements: number;
  status: string;
  hasActivePlacement: boolean;
  totalPaid: number;
  daysLeft: number | null;
}

const CITIES = ['Delhi', 'Gurgaon', 'Noida', 'Greater Noida', 'Mumbai', 'Pune', 'Bangalore', 'Mangalore'];

export function Customers() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<CustomerRow[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    city: 'Delhi',
    locality: '',
    notes: '',
  });

  const load = async () => {
    try {
      setError('');
      const res = await fetch('/api/customers');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setCustomers(json.customers);
    } catch {
      setError('Could not load customers. Please refresh.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!customers) return [];
    return customers.filter((c) => {
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q) ||
          (c.locality || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [customers, query, statusFilter]);

  const submit = async () => {
    if (!form.name.trim() || !form.city) {
      toast({ title: 'Name and city are required.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to add customer');
      toast({ title: `Customer "${form.name}" added`, description: 'Record a plan sale to activate coverage.' });
      setDialogOpen(false);
      setForm({ name: '', phone: '', email: '', city: 'Delhi', locality: '', notes: '' });
      await load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Failed to add customer', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (c: CustomerRow) => {
    try {
      const res = await fetch(`/api/customers?id=${c.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete');
      toast({ title: `Customer "${c.name}" deleted` });
      await load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Failed to delete customer', variant: 'destructive' });
    }
  };

  if (error) return <ErrorNote message={error} />;
  if (!customers) return <LoadingBlock label="Loading customers…" />;

  return (
    <div className="space-y-5">
      <FadeIn delay={0.05}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              placeholder="Search name, city or locality…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 sm:max-w-xs"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="EXPIRED">Expired</SelectItem>
                <SelectItem value="REFUNDED">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="shrink-0">
            <Plus className="h-4 w-4" /> Add Customer
          </Button>
        </div>
      </FadeIn>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((c, i) => {
          const coverageLeft = c.maxPlacements - c.placementsUsed;
          const expirySoon = c.daysLeft != null && c.daysLeft < 30 && c.daysLeft > 0;
          return (
            <FadeIn key={c.id} delay={0.03 + Math.min(i * 0.03, 0.24)} y={10}>
              <div
                className={cn(
                  'press card-shadow group flex h-full flex-col rounded-[20px] border border-black/[0.06] bg-card p-5 transition-shadow hover:card-shadow-hover',
                  c.status === 'EXPIRED' && 'opacity-75'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Avatar name={c.name} size={42} />
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold leading-tight tracking-[-0.01em]">{c.name}</p>
                      <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                        {c.locality ? `${c.locality}, ` : ''}
                        {c.city}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <CustomerStatusBadge status={c.status} />
                    {c.planType && <PlanBadge plan={c.planType} />}
                  </div>
                </div>

                {(c.phone || c.email) && (
                  <div className="mt-3.5 space-y-1 text-[13px] text-muted-foreground">
                    {c.phone && (
                      <p className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} /> {c.phone}
                      </p>
                    )}
                    {c.email && (
                      <p className="flex items-center gap-2 truncate">
                        <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} /> {c.email}
                      </p>
                    )}
                  </div>
                )}

                {c.planType ? (
                  <div className="mt-4 space-y-2.5 border-t border-black/[0.05] pt-4">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-muted-foreground">Coverage</span>
                      <span className="num font-semibold">
                        {c.placementsUsed}/{c.maxPlacements} placements
                      </span>
                    </div>
                    <div className="h-[6px] overflow-hidden rounded-full bg-black/[0.05]" aria-hidden="true">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          coverageLeft <= 0 ? 'bg-[#FF3B30]' : coverageLeft <= 1 ? 'bg-[#FF9500]' : 'bg-[#34C759]'
                        )}
                        style={{ width: `${Math.min(100, (c.placementsUsed / Math.max(1, c.maxPlacements)) * 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-muted-foreground">
                        {c.planExpiryDate ? `Expires ${fmtDate(c.planExpiryDate)}` : ''}
                      </span>
                      <span className={cn('font-medium', expirySoon ? 'text-[#C77C00]' : 'text-muted-foreground')}>
                        {c.daysLeft != null && c.daysLeft > 0
                          ? `${c.daysLeft} days left`
                          : c.daysLeft != null && c.daysLeft <= 0
                            ? 'Expired'
                            : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 border-t border-black/[0.05] pt-2.5 text-[12px]">
                      <span
                        className={cn(
                          'flex items-center gap-1.5 font-medium',
                          c.hasActivePlacement ? 'text-[#248A3D]' : 'text-muted-foreground'
                        )}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.9} />
                        {c.hasActivePlacement ? 'Helper placed' : 'No active placement'}
                      </span>
                      <span className="num ml-auto text-muted-foreground">Paid {fmtMoney(c.totalPaid, { compact: true })}</span>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 rounded-[12px] bg-black/[0.03] p-3 text-[12.5px] leading-relaxed text-muted-foreground">
                    No plan yet — record a plan sale to activate coverage.
                  </p>
                )}

                {c.notes && (
                  <p className="mt-2.5 rounded-[12px] bg-black/[0.03] p-3 text-[12px] leading-relaxed text-muted-foreground">{c.notes}</p>
                )}

                {!c.planType && !c.hasActivePlacement && (
                  <div className="mt-auto pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 rounded-full px-2.5 text-[12px] text-muted-foreground opacity-0 transition-opacity hover:bg-[#FF3B30]/[0.07] hover:text-[#FF3B30] group-hover:opacity-100"
                      onClick={() => remove(c)}
                      aria-label="Delete customer"
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
              <Users className="h-6 w-6 text-muted-foreground" strokeWidth={1.6} />
            </span>
            <p className="text-[15px] font-semibold">No customers found</p>
            <p className="text-[13px] text-muted-foreground">Try clearing the search or filters.</p>
          </div>
        )}
      </div>

      {/* add customer dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
            <DialogDescription>Create a household customer record.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cust-name">Name *</Label>
                <Input
                  id="cust-name"
                  placeholder="Rohit Kapoor"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cust-phone">Phone</Label>
                <Input
                  id="cust-phone"
                  placeholder="+91 98xxxxxxx"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
              <div className="space-y-1.5">
                <Label htmlFor="cust-locality">Locality</Label>
                <Input
                  id="cust-locality"
                  placeholder="DLF Phase 3"
                  value={form.locality}
                  onChange={(e) => setForm({ ...form, locality: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-email">Email</Label>
              <Input
                id="cust-email"
                type="email"
                placeholder="rohit@gmail.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-notes">Notes</Label>
              <Textarea
                id="cust-notes"
                placeholder="Requirements, preferences…"
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
              {submitting ? 'Adding…' : 'Add Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

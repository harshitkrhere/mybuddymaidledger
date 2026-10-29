'use client';

import { useEffect, useState } from 'react';
import { Building2, Save, Download, ShieldCheck, FileJson } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { LoadingBlock, ErrorNote, FadeIn, Card } from './shared';

interface SettingsData {
  companyName: string;
  companyTagline: string;
  gstin: string;
  address: string;
  phone: string;
  email: string;
  defaultGstRate: number | string;
  nonRefundablePortion: number | string;
  supportHours: string;
}

function GroupIcon({ children, tone }: { children: React.ReactNode; tone: 'blue' | 'green' | 'orange' }) {
  const tones = {
    blue: 'bg-[#0071E3]/10 text-[#0071E3]',
    green: 'bg-[#34C759]/12 text-[#248A3D]',
    orange: 'bg-[#FF9500]/12 text-[#C77C00]',
  };
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Settings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) throw new Error();
        const json = await res.json();
        setSettings(json.settings);
      } catch {
        setError('Could not load settings. Please refresh.');
      }
    })();
  }, []);

  const set = (key: keyof SettingsData, value: string) =>
    setSettings((s) => (s ? { ...s, [key]: value } : s));

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save settings');
      setSettings(json.settings);
      toast({
        title: 'Settings saved',
        description: 'Company profile and defaults updated. New receipts will use these details.',
      });
    } catch (e) {
      toast({
        title: 'Could not save settings',
        description: e instanceof Error ? e.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const downloadBackup = async () => {
    setBackingUp(true);
    try {
      const res = await fetch('/api/backup');
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mybuddymaid-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: 'Backup downloaded',
        description: 'Keep this file safe — it contains your complete books and records.',
      });
    } catch {
      toast({
        title: 'Backup failed',
        description: 'Could not generate the backup file. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setBackingUp(false);
    }
  };

  if (error) return <ErrorNote message={error} />;
  if (!settings) return <LoadingBlock label="Loading settings…" />;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Company profile */}
      <FadeIn delay={0.05}>
        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <GroupIcon tone="blue">
              <Building2 className="h-4.5 w-4.5 h-[18px] w-[18px]" strokeWidth={1.9} />
            </GroupIcon>
            <div>
              <h2 className="text-[17px] font-semibold tracking-[-0.015em]">Company Profile</h2>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                Printed on every GST receipt. Keep this accurate for tax filing.
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="companyName">Company name</Label>
                <Input
                  id="companyName"
                  value={settings.companyName}
                  onChange={(e) => set('companyName', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="companyTagline">Tagline</Label>
                <Input
                  id="companyTagline"
                  value={settings.companyTagline}
                  onChange={(e) => set('companyTagline', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gstin">
                GSTIN{' '}
                <span className="font-normal text-muted-foreground">(leave blank if not registered)</span>
              </Label>
              <Input
                id="gstin"
                placeholder="07ABCDE1234F1Z5"
                value={settings.gstin}
                onChange={(e) => set('gstin', e.target.value.toUpperCase())}
                className="font-mono uppercase"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">Registered address</Label>
              <Input
                id="address"
                value={settings.address}
                onChange={(e) => set('address', e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={settings.phone}
                  onChange={(e) => set('phone', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={settings.email}
                  onChange={(e) => set('email', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="supportHours">Support hours (printed on receipts)</Label>
              <Input
                id="supportHours"
                value={settings.supportHours}
                onChange={(e) => set('supportHours', e.target.value)}
              />
            </div>
          </div>
        </Card>
      </FadeIn>

      {/* Financial defaults */}
      <FadeIn delay={0.1}>
        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <GroupIcon tone="green">
              <ShieldCheck className="h-[18px] w-[18px]" strokeWidth={1.9} />
            </GroupIcon>
            <div>
              <h2 className="text-[17px] font-semibold tracking-[-0.015em]">Financial Defaults</h2>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">Applied to new plan sales and refund calculations.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="defaultGstRate">Default GST rate (%)</Label>
              <Input
                id="defaultGstRate"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={String(settings.defaultGstRate)}
                onChange={(e) => set('defaultGstRate', e.target.value)}
                className="num text-right"
              />
              <p className="text-[12px] text-muted-foreground">Placement services typically attract 18%.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nonRefundablePortion">Non-refundable portion (₹)</Label>
              <Input
                id="nonRefundablePortion"
                type="number"
                min="0"
                step="1"
                value={String(settings.nonRefundablePortion)}
                onChange={(e) => set('nonRefundablePortion', e.target.value)}
                className="num text-right"
              />
              <p className="text-[12px] text-muted-foreground">Deducted from refunds — covers onboarding &amp; verification.</p>
            </div>
          </div>
        </Card>
      </FadeIn>

      <FadeIn delay={0.14}>
        <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save Settings'}
        </Button>
      </FadeIn>

      {/* Backup */}
      <FadeIn delay={0.18}>
        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <GroupIcon tone="orange">
              <FileJson className="h-[18px] w-[18px]" strokeWidth={1.9} />
            </GroupIcon>
            <div>
              <h2 className="text-[17px] font-semibold tracking-[-0.015em]">Data Backup</h2>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
                Download a complete JSON snapshot — chart of accounts, full journal, customers, helpers,
                placements, plan sales and expenses — with a built-in ledger balance check.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={downloadBackup} disabled={backingUp}>
              <Download className="h-4 w-4" />
              {backingUp ? 'Preparing backup…' : 'Download Full Backup'}
            </Button>
            <p className="text-[12px] text-muted-foreground">Recommended weekly, and always before major changes.</p>
          </div>
        </Card>
      </FadeIn>
    </div>
  );
}

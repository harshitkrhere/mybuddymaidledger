'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  ChevronRight,
  Ellipsis,
  HeartHandshake,
  Home,
  LineChart,
  Link as LinkIcon,
  Plus,
  ReceiptText,
  Search,
  Settings as SettingsIcon,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';

// =============================
// Page model
// =============================

export type PageId =
  | 'dashboard'
  | 'plan-sales'
  | 'customers'
  | 'helpers'
  | 'placements'
  | 'expenses'
  | 'accounts'
  | 'journal'
  | 'reports'
  | 'settings';

export interface NavItem {
  id: PageId;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [{ id: 'dashboard', label: 'Dashboard', icon: Home }],
  },
  {
    label: 'Business',
    items: [
      { id: 'plan-sales', label: 'Plan Sales', icon: ReceiptText },
      { id: 'customers', label: 'Customers', icon: Users },
      { id: 'helpers', label: 'Helpers', icon: HeartHandshake },
      { id: 'placements', label: 'Placements', icon: LinkIcon },
    ],
  },
  {
    label: 'Finance',
    items: [
      { id: 'expenses', label: 'Payments', icon: Wallet },
      { id: 'accounts', label: 'Accounting', icon: BookOpen },
      { id: 'reports', label: 'Reports', icon: LineChart },
    ],
  },
];

export const ALL_NAV: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), { id: 'settings', label: 'Settings', icon: SettingsIcon }];

export const PAGE_META: Record<PageId, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Your business at a glance' },
  'plan-sales': { title: 'Plan Sales', subtitle: 'Silver, Gold & Diamond — GST posts automatically' },
  customers: { title: 'Customers', subtitle: 'Households, plan coverage and placements' },
  helpers: { title: 'Helpers', subtitle: 'Verification and readiness for placement' },
  placements: { title: 'Placements', subtitle: 'Families matched with helpers' },
  expenses: { title: 'Payments', subtitle: 'Money out, posted to the ledger' },
  accounts: { title: 'Accounting', subtitle: 'The chart of accounts' },
  journal: { title: 'Accounting', subtitle: 'The double-entry journal' },
  reports: { title: 'Reports', subtitle: 'Profit & Loss, Balance Sheet, Trial Balance' },
  settings: { title: 'Settings', subtitle: 'Company profile and data' },
};

// =============================
// Brand mark — app-icon tile
// =============================

export function BrandMark({ size = 32, radius = 9 }: { size?: number; radius?: number }) {
  return (
    <div
      aria-hidden="true"
      className="relative flex shrink-0 items-center justify-center bg-gradient-to-b from-[#3E9BFF] to-[#0066D6] text-white shadow-[0_2px_8px_rgba(0,102,214,0.35)]"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <Home className="h-[55%] w-[55%]" strokeWidth={2.2} />
    </div>
  );
}

// =============================
// Sidebar — macOS-style frosted navigation
// =============================

export function Sidebar({ page, onNavigate }: { page: PageId; onNavigate: (p: PageId) => void }) {
  return (
    <aside className="glass fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-black/[0.06] lg:flex">
      {/* brand */}
      <div className="flex items-center gap-3 px-5 pb-2 pt-5">
        <BrandMark size={34} radius={10} />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground">MyBuddyMaid</p>
          <p className="text-[11px] font-medium text-muted-foreground">Business Operations</p>
        </div>
      </div>

      {/* nav */}
      <nav aria-label="Primary" className="thin-scroll mt-3 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="micro-label px-3 pb-1.5">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <SidebarItem
                  key={item.id}
                  item={item}
                  active={page === item.id || (item.id === 'accounts' && page === 'journal')}
                  onSelect={() => onNavigate(item.id)}
                />
              ))}
            </ul>
          </div>
        ))}
        <div>
          <p className="micro-label px-3 pb-1.5">General</p>
          <ul className="space-y-0.5">
            <SidebarItem
              item={{ id: 'settings', label: 'Settings', icon: SettingsIcon }}
              active={page === 'settings'}
              onSelect={() => onNavigate('settings')}
            />
          </ul>
        </div>
      </nav>

      {/* account */}
      <div className="border-t border-black/[0.06] p-3">
        <div className="flex items-center gap-3 rounded-[12px] px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#5AC8FA] to-[#0A84FF] text-[12px] font-semibold text-white">
            AV
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight text-foreground">A. Verma</p>
            <p className="text-[11px] leading-tight text-muted-foreground">Proprietor</p>
          </div>
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#34C759]" aria-label="Online" />
        </div>
      </div>
    </aside>
  );
}

function SidebarItem({ item, active, onSelect }: { item: NavItem; active: boolean; onSelect: () => void }) {
  const Icon = item.icon;
  return (
    <li>
      <button
        onClick={onSelect}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'press relative flex w-full items-center gap-3 rounded-[10px] px-3 py-[7px] text-[14px] font-medium outline-none',
          'focus-visible:ring-2 focus-visible:ring-ring/60',
          active ? 'text-[#0071E3]' : 'text-foreground/75 hover:bg-black/[0.04] hover:text-foreground'
        )}
      >
        {active && (
          <motion.span
            layoutId="sidebar-active"
            transition={{ type: 'spring', stiffness: 480, damping: 42 }}
            className="absolute inset-0 rounded-[10px] bg-[#0071E3]/[0.09]"
          />
        )}
        <Icon className={cn('relative z-10 h-[17px] w-[17px]', active ? 'text-[#0071E3]' : 'text-muted-foreground')} strokeWidth={active ? 2.2 : 1.9} />
        <span className="relative z-10 tracking-[-0.01em]">{item.label}</span>
      </button>
    </li>
  );
}

// =============================
// Mobile tab bar + More sheet
// =============================

const TAB_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Home', icon: Home },
  { id: 'plan-sales', label: 'Sales', icon: ReceiptText },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'helpers', label: 'Helpers', icon: HeartHandshake },
];

export function MobileTabBar({
  page,
  onNavigate,
  onOpenMore,
}: {
  page: PageId;
  onNavigate: (p: PageId) => void;
  onOpenMore: () => void;
}) {
  const moreActive = !TAB_ITEMS.some((t) => t.id === page) && !['dashboard'].includes(page) ? true : TAB_ITEMS.some((t) => t.id === page);
  const isMore = !TAB_ITEMS.some((t) => t.id === page);
  return (
    <nav
      aria-label="Primary mobile"
      className="glass fixed inset-x-0 bottom-0 z-40 flex border-t border-black/[0.07] pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {TAB_ITEMS.map((t) => {
        const active = page === t.id;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            onClick={() => onNavigate(t.id)}
            aria-current={active ? 'page' : undefined}
            className="press relative flex flex-1 flex-col items-center gap-[3px] py-[7px]"
          >
            {active && (
              <motion.span
                layoutId="tab-active"
                transition={{ type: 'spring', stiffness: 500, damping: 45 }}
                className="absolute top-0 h-[2.5px] w-9 rounded-full bg-[#0071E3]"
              />
            )}
            <Icon className={cn('h-[22px] w-[22px]', active ? 'text-[#0071E3]' : 'text-[#8E8E93]')} strokeWidth={active ? 2.2 : 1.8} />
            <span className={cn('text-[10px] font-medium', active ? 'text-[#0071E3]' : 'text-[#8E8E93]')}>{t.label}</span>
          </button>
        );
      })}
      <button
        onClick={onOpenMore}
        aria-label="More pages"
        className={cn('press relative flex flex-1 flex-col items-center gap-[3px] py-[7px]', moreActive && isMore && 'text-[#0071E3]')}
      >
        {isMore && moreActive && (
          <motion.span layoutId="tab-active" transition={{ type: 'spring', stiffness: 500, damping: 45 }} className="absolute top-0 h-[2.5px] w-9 rounded-full bg-[#0071E3]" />
        )}
        <Ellipsis className={cn('h-[22px] w-[22px]', isMore ? 'text-[#0071E3]' : 'text-[#8E8E93]')} strokeWidth={1.8} />
        <span className={cn('text-[10px] font-medium', isMore ? 'text-[#0071E3]' : 'text-[#8E8E93]')}>More</span>
      </button>
    </nav>
  );
}

export function MoreSheet({
  open,
  onOpenChange,
  page,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  page: PageId;
  onNavigate: (p: PageId) => void;
}) {
  const go = (id: PageId) => {
    onOpenChange(false);
    onNavigate(id);
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-[26px] border-0 bg-white/90 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-2xl"
      >
        <div className="mx-auto mb-3 h-[5px] w-10 rounded-full bg-black/15" aria-hidden="true" />
        <SheetTitle className="text-center text-[17px] font-semibold tracking-[-0.01em]">All Pages</SheetTitle>
        <SheetDescription className="sr-only">Navigate to any section of the workspace</SheetDescription>
        <div className="mt-4 grid grid-cols-4 gap-x-2 gap-y-4">
          {ALL_NAV.map((item) => {
            const Icon = item.icon;
            const active = page === item.id || (item.id === 'accounts' && page === 'journal');
            return (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                className="press flex flex-col items-center gap-1.5"
              >
                <span
                  className={cn(
                    'flex h-[52px] w-[52px] items-center justify-center rounded-[16px] transition-colors',
                    active ? 'bg-[#0071E3]/10' : 'bg-black/[0.04]'
                  )}
                >
                  <Icon className={cn('h-6 w-6', active ? 'text-[#0071E3]' : 'text-[#55555C]')} strokeWidth={1.9} />
                </span>
                <span className={cn('text-[11px] font-medium', active ? 'text-[#0071E3]' : 'text-foreground/80')}>{item.label}</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => onOpenChange(false)}
          className="press mt-5 w-full rounded-full bg-black/[0.05] py-2.5 text-[15px] font-semibold text-[#0071E3] hover:bg-black/[0.08]"
        >
          Done
        </button>
      </SheetContent>
    </Sheet>
  );
}

// =============================
// Toolbar — sticky, frosted, large-title compaction
// =============================

export function Toolbar({
  page,
  scrolled,
  onOpenSearch,
  onNew,
}: {
  page: PageId;
  scrolled: boolean;
  onOpenSearch: () => void;
  onNew: () => void;
}) {
  const title = PAGE_META[page].title;
  return (
    <header
      className={cn(
        'glass sticky top-0 z-40 transition-[border-color] duration-300',
        scrolled ? 'border-b border-black/[0.07]' : 'border-b border-transparent'
      )}
    >
      <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        {/* mobile brand / compact title */}
        <div className="flex min-w-0 items-center gap-2.5 lg:hidden">
          <BrandMark size={26} radius={7} />
          <span
            className={cn(
              'truncate text-[15px] font-semibold tracking-[-0.01em] transition-all duration-300',
              scrolled ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
            )}
          >
            {title}
          </span>
        </div>

        {/* desktop compact title — fades in when the large title scrolls away */}
        <p
          className={cn(
            'hidden min-w-0 truncate text-[15px] font-semibold tracking-[-0.01em] transition-all duration-300 lg:block',
            scrolled ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
          )}
        >
          {title}
        </p>

        <div className="ml-auto flex items-center gap-2">
          {/* search */}
          <button
            onClick={onOpenSearch}
            aria-label="Search (Command K)"
            className="press flex h-9 items-center gap-2 rounded-full bg-black/[0.05] px-3.5 text-muted-foreground hover:bg-black/[0.07] sm:w-[210px]"
          >
            <Search className="h-4 w-4 shrink-0" strokeWidth={2} />
            <span className="hidden flex-1 text-left text-[13px] sm:block">Search</span>
            <kbd className="hidden rounded-md bg-white px-1.5 py-0.5 font-sans text-[11px] font-medium text-muted-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08)] sm:block">
              ⌘K
            </kbd>
          </button>

          {/* new */}
          <button
            onClick={onNew}
            className="press flex h-9 items-center gap-1.5 rounded-full bg-[#0071E3] px-4 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(0,113,227,0.35)] hover:bg-[#0077ED]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            <span className="hidden sm:block">New Sale</span>
          </button>
        </div>
      </div>
    </header>
  );
}

// =============================
// Large title — iOS style
// =============================

export function LargeTitle({ page }: { page: PageId }) {
  const { title, subtitle } = PAGE_META[page];
  return (
    <div className="pb-5 pt-7 sm:pt-8">
      <motion.h1
        key={page}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        className="text-[32px] font-bold leading-[1.05] tracking-[-0.025em] text-foreground sm:text-[36px]"
      >
        {title}
      </motion.h1>
      <motion.p
        key={`${page}-sub`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.08 }}
        className="mt-1.5 text-[15px] text-muted-foreground"
      >
        {subtitle}
      </motion.p>
    </div>
  );
}

// =============================
// Page transition
// =============================

export function PageTransition({ pageKey, children }: { pageKey: PageId; children: React.ReactNode }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pageKey}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.34, ease: [0.32, 0.72, 0, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// =============================
// Segmented control — iOS style
// =============================

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const id = useId();
  const h = size === 'sm' ? 'h-[30px]' : 'h-[36px]';
  const px = size === 'sm' ? 'px-3' : 'px-3.5';
  return (
    <div
      role="tablist"
      className={cn('no-scrollbar inline-flex max-w-full items-center gap-[2px] overflow-x-auto rounded-[11px] bg-black/[0.05] p-[2px]', className)}
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'press relative shrink-0 rounded-[9px] text-[13px] font-medium tracking-[-0.01em] outline-none',
              h,
              px,
              'focus-visible:ring-2 focus-visible:ring-ring/60'
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={{ type: 'spring', stiffness: 500, damping: 44 }}
                className="absolute inset-0 rounded-[9px] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.04)]"
              />
            )}
            <span className={cn('relative z-10 whitespace-nowrap', active ? 'text-foreground' : 'text-muted-foreground')}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function AccountingTabs({ active, onNavigate }: { active: 'accounts' | 'journal'; onNavigate: (p: PageId) => void }) {
  return (
    <SegmentedControl
      options={[
        { value: 'accounts', label: 'Chart of Accounts' },
        { value: 'journal', label: 'Journal' },
      ]}
      value={active}
      onChange={(v) => onNavigate(v as PageId)}
    />
  );
}

// =============================
// Spotlight — ⌘K quick search (pages, customers, helpers)
// =============================

interface SearchCustomer {
  id: string;
  name: string;
  city: string;
}
interface SearchHelper {
  id: string;
  name: string;
  city: string;
}

interface SpotlightResult {
  key: string;
  group: 'Pages' | 'Customers' | 'Helpers';
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  meta: string;
  page: PageId;
}

export function SpotlightSearch({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (p: PageId) => void;
}) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [customers, setCustomers] = useState<SearchCustomer[] | null>(null);
  const [helpers, setHelpers] = useState<SearchHelper[] | null>(null);

  // load entity data the first time spotlight opens
  useEffect(() => {
    if (!open || customers) return;
    Promise.all([fetch('/api/customers'), fetch('/api/helpers')])
      .then(async ([c, h]) => {
        if (c.ok) setCustomers((await c.json()).customers?.slice(0, 60) ?? []);
        else setCustomers([]);
        if (h.ok) setHelpers((await h.json()).helpers?.slice(0, 60) ?? []);
        else setHelpers([]);
      })
      .catch(() => {
        setCustomers([]);
        setHelpers([]);
      });
  }, [open, customers]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo<SpotlightResult[]>(() => {
    const q = query.trim().toLowerCase();
    const out: SpotlightResult[] = [];
    for (const n of ALL_NAV) {
      if (!q || n.label.toLowerCase().includes(q)) {
        out.push({ key: `p-${n.id}`, group: 'Pages', icon: n.icon, title: n.label, meta: 'Page', page: n.id });
      }
    }
    if (q) {
      for (const c of customers ?? []) {
        if (c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q)) {
          out.push({ key: `c-${c.id}`, group: 'Customers', icon: Users, title: c.name, meta: c.city, page: 'customers' });
        }
      }
      for (const h of helpers ?? []) {
        if (h.name.toLowerCase().includes(q) || h.city.toLowerCase().includes(q)) {
          out.push({ key: `h-${h.id}`, group: 'Helpers', icon: HeartHandshake, title: h.name, meta: h.city, page: 'helpers' });
        }
      }
    }
    return out.slice(0, 12);
  }, [query, customers, helpers]);

  const choose = useCallback(
    (r: SpotlightResult) => {
      onNavigate(r.page);
      onClose();
    },
    [onNavigate, onClose]
  );

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = results[activeIndex];
      if (r) choose(r);
    }
  };

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  let lastGroup = '';

  return (
    <motion.div
      key="spotlight"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/15 p-4 backdrop-blur-[2px] sm:pt-[16vh]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Quick search"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: -4 }}
        transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
        className="w-full max-w-[560px] overflow-hidden rounded-[18px] bg-white/95 shadow-[0_24px_80px_-16px_rgba(0,0,0,0.35),0_0_0_0.5px_rgba(0,0,0,0.08)] backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
          {/* input row */}
          <div className="flex items-center gap-3 border-b border-black/[0.06] px-4">
            <Search className="h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={2} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onInputKeyDown}
              placeholder="Search pages, customers, helpers…"
              className="h-[52px] flex-1 bg-transparent text-[16px] tracking-[-0.01em] outline-none placeholder:text-muted-foreground/70"
            />
            <button
              onClick={onClose}
              className="press flex h-6 w-6 items-center justify-center rounded-full bg-black/[0.06] text-muted-foreground hover:bg-black/[0.1]"
              aria-label="Close search"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </div>

          {/* results */}
          <div ref={listRef} className="thin-scroll max-h-[46vh] overflow-y-auto p-2">
            {results.length === 0 && (
              <p className="px-3 py-8 text-center text-[14px] text-muted-foreground">
                {customers === null ? 'Loading…' : 'No results found'}
              </p>
            )}
            {results.map((r, i) => {
              const showGroup = r.group !== lastGroup;
              lastGroup = r.group;
              const Icon = r.icon;
              const active = i === activeIndex;
              return (
                <div key={r.key}>
                  {showGroup && <p className="micro-label px-3 pb-1 pt-3">{r.group}</p>}
                  <button
                    data-active={active}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => choose(r)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left',
                      active ? 'bg-[#0071E3]/[0.08]' : 'hover:bg-black/[0.03]'
                    )}
                  >
                    {r.group === 'Pages' ? (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-black/[0.05]">
                        <Icon className="h-4 w-4 text-[#55555C]" strokeWidth={1.9} />
                      </span>
                    ) : (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0071E3]/10 text-[10px] font-semibold text-[#0071E3]">
                        {r.title
                          .split(' ')
                          .map((w) => w[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-[14px] font-medium tracking-[-0.01em]">{r.title}</span>
                    <span className="shrink-0 text-[12px] text-muted-foreground">{r.meta}</span>
                    <ChevronRight className={cn('h-4 w-4 shrink-0 transition-opacity', active ? 'text-[#0071E3] opacity-100' : 'opacity-0')} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* footer hints */}
          <div className="flex items-center gap-4 border-t border-black/[0.06] px-4 py-2.5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <kbd className="rounded bg-black/[0.05] px-1.5 py-0.5 font-sans text-[10px] font-medium">↑↓</kbd> navigate
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="rounded bg-black/[0.05] px-1.5 py-0.5 font-sans text-[10px] font-medium">↵</kbd> open
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="rounded bg-black/[0.05] px-1.5 py-0.5 font-sans text-[10px] font-medium">esc</kbd> close
            </span>
          </div>
        </motion.div>
      </motion.div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Sidebar,
  MobileTabBar,
  MoreSheet,
  Toolbar,
  LargeTitle,
  PageTransition,
  SpotlightSearch,
  AccountingTabs,
  type PageId,
} from '@/components/erp/shell';
import { Dashboard } from '@/components/erp/dashboard';
import { PlanSales } from '@/components/erp/plan-sales';
import { Customers } from '@/components/erp/customers';
import { Helpers } from '@/components/erp/helpers';
import { Placements } from '@/components/erp/placements';
import { Expenses } from '@/components/erp/expenses';
import { ChartOfAccounts } from '@/components/erp/chart-of-accounts';
import { Journal } from '@/components/erp/journal';
import { Reports } from '@/components/erp/reports';
import { Settings } from '@/components/erp/settings';

export default function Home() {
  const [page, setPage] = useState<PageId>('dashboard');
  const [scrolled, setScrolled] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // large-title compaction on scroll
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrolled(window.scrollY > 72));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // ⌘K / Ctrl+K toggles spotlight; Esc closes it
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const navigate = useCallback((p: string) => {
    setPage(p as PageId);
    setMoreOpen(false);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  // global "New Sale" — jumps to Plan Sales and opens the record dialog
  const newSale = useCallback(() => {
    navigate('plan-sales');
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('mbm:new-plan-sale')), 420);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar page={page} onNavigate={navigate} />

      <div className="flex min-h-screen flex-col lg:pl-[248px]">
        <Toolbar page={page} scrolled={scrolled} onOpenSearch={() => setSearchOpen(true)} onNew={newSale} />

        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-28 pt-0 sm:px-6 lg:px-8 lg:pb-16">
          <LargeTitle page={page} />

          {(page === 'accounts' || page === 'journal') && (
            <div className="pb-5">
              <AccountingTabs active={page === 'journal' ? 'journal' : 'accounts'} onNavigate={navigate} />
            </div>
          )}

          <PageTransition pageKey={page}>
            {page === 'dashboard' && <Dashboard onNavigate={navigate} />}
            {page === 'plan-sales' && <PlanSales />}
            {page === 'customers' && <Customers />}
            {page === 'helpers' && <Helpers />}
            {page === 'placements' && <Placements />}
            {page === 'expenses' && <Expenses />}
            {page === 'accounts' && <ChartOfAccounts />}
            {page === 'journal' && <Journal />}
            {page === 'reports' && <Reports />}
            {page === 'settings' && <Settings />}
          </PageTransition>
        </main>
      </div>

      <MobileTabBar page={page} onNavigate={navigate} onOpenMore={() => setMoreOpen(true)} />
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} page={page} onNavigate={navigate} />
      <AnimatePresence>
        {searchOpen && (
          <SpotlightSearch key="spotlight" open={searchOpen} onClose={() => setSearchOpen(false)} onNavigate={navigate} />
        )}
      </AnimatePresence>
    </div>
  );
}

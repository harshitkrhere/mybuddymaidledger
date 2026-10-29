'use client';

import { Printer, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ReceiptActions({ saleId }: { saleId: string }) {
  const print = () => window.print();

  return (
    <div className="no-print glass sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] px-4 py-2.5 sm:px-8">
      <Button variant="ghost" size="sm" className="rounded-full" onClick={() => history.back()}>
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>
      <p className="num hidden text-[12px] text-muted-foreground sm:block">
        Receipt ID {saleId.slice(0, 8).toUpperCase()}
      </p>
      <Button size="sm" onClick={print}>
        <Printer className="h-4 w-4" />
        Print / Save as PDF
      </Button>
    </div>
  );
}

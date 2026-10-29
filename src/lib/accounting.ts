import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';

/** Prisma client or an interactive transaction handle. */
export type Tx = Prisma.TransactionClient;

// =============================
// Business configuration
// =============================

export const PLANS = {
  SILVER: { label: 'Silver', fee: 4999, coverageMonths: 10, maxPlacements: 3, profiles: 3 },
  GOLD: { label: 'Gold', fee: 5999, coverageMonths: 12, maxPlacements: 5, profiles: 4 },
  DIAMOND: { label: 'Diamond', fee: 6999, coverageMonths: 18, maxPlacements: 10, profiles: 5 },
} as const;

export type PlanType = keyof typeof PLANS;

export const SERVICE_TYPES: Record<string, string> = {
  FULL_TIME_MAID: 'Full-Time Maid',
  PART_TIME_MAID: 'Part-Time Maid',
  COOK: 'Cook',
  BABYSITTER: 'Babysitter / Nanny',
  ELDER_CARE: 'Elder Care',
  DOMESTIC_HELP: 'Domestic Help',
};

export const PAYMENT_MODES: Record<string, string> = {
  UPI: 'UPI',
  BANK: 'Bank Transfer',
  CARD: 'Card',
  CASH: 'Cash',
};

export const DEFAULT_GST_RATE = 18;
export const NON_REFUNDABLE_PORTION = 2000;

// =============================
// Accounting core
// =============================

export const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export function isDebitNormal(type: string): boolean {
  return type === 'ASSET' || type === 'EXPENSE';
}

export function money(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface AccountBalance {
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

export async function getAccountBalances(range?: {
  from?: Date;
  to?: Date;
}): Promise<AccountBalance[]> {
  const accounts = await db.account.findMany({
    orderBy: { code: 'asc' },
    include: {
      journalLines: {
        where: {
          entry: {
            isPosted: true,
            ...(range?.from || range?.to
              ? {
                  date: {
                    ...(range?.from ? { gte: range.from } : {}),
                    ...(range?.to ? { lt: range.to } : {}),
                  },
                }
              : {}),
          },
        },
        select: { debit: true, credit: true },
      },
    },
  });

  return accounts.map((a) => {
    const debitTotal = money(a.journalLines.reduce((s, l) => s + l.debit, 0));
    const creditTotal = money(a.journalLines.reduce((s, l) => s + l.credit, 0));
    const raw = isDebitNormal(a.type) ? debitTotal - creditTotal : creditTotal - debitTotal;
    return {
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      subtype: a.subtype,
      isActive: a.isActive,
      debitTotal,
      creditTotal,
      balance: money(raw),
    };
  });
}

export async function nextDocNumber(kind: 'JE' | 'SALE', tx: Tx = db): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = kind === 'JE' ? 'JE' : 'SALE';
  const like = `${prefix}-${year}-`;

  // JE numbers come from JournalEntry.entryNumber; SALE numbers come from the
  // reference stamped on PLAN_SALE journal entries (PlanSale has no doc column).
  const rows =
    kind === 'JE'
      ? await tx.journalEntry.findMany({
          where: { entryNumber: { startsWith: like } },
          select: { entryNumber: true },
        })
      : await tx.journalEntry.findMany({
          where: { reference: { startsWith: like }, source: 'PLAN_SALE' },
          select: { reference: true },
        });

  const max = rows.reduce((m, r) => {
    const value = 'entryNumber' in r ? r.entryNumber : 'reference' in r ? r.reference || '' : '';
    const n = parseInt(value.split('-')[2] || '0', 10);
    return Math.max(m, isNaN(n) ? 0 : n);
  }, 0);
  return `${prefix}-${year}-${String(max + 1).padStart(4, '0')}`;
}

export interface JournalLineInput {
  accountId: string;
  debit?: number;
  credit?: number;
  memo?: string;
}

export async function createJournalEntry(
  input: {
    date: Date;
    memo: string;
    reference?: string;
    source?: string;
    lines: JournalLineInput[];
  },
  tx: Tx = db
) {
  const lines = input.lines.map((l) => ({
    accountId: l.accountId,
    debit: money(l.debit || 0),
    credit: money(l.credit || 0),
    memo: l.memo,
  }));

  const totalDebit = money(lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = money(lines.reduce((s, l) => s + l.credit, 0));

  if (Math.abs(totalDebit - totalCredit) > 0.005) {
    throw Object.assign(new Error('Journal entry is not balanced: debits must equal credits.'), {
      status: 400,
    });
  }
  if (totalDebit === 0) {
    throw Object.assign(new Error('Journal entry total cannot be zero.'), { status: 400 });
  }
  if (lines.length < 2) {
    throw Object.assign(new Error('A journal entry needs at least two lines.'), { status: 400 });
  }

  const accountIds = [...new Set(lines.map((l) => l.accountId))];
  const accounts = await tx.account.findMany({ where: { id: { in: accountIds } } });
  if (accounts.length !== accountIds.length) {
    throw Object.assign(new Error('One or more accounts do not exist.'), { status: 400 });
  }

  return tx.journalEntry.create({
    data: {
      entryNumber: await nextDocNumber('JE', tx),
      date: input.date,
      memo: input.memo,
      reference: input.reference,
      source: input.source || 'MANUAL',
      lines: { create: lines },
    },
    include: { lines: { include: { account: true } } },
  });
}

// =============================
// Account codes
// =============================

export const ACCOUNT_CODE = {
  CASH: '1000',
  BANK: '1010',
  GST_PAYABLE: '2200',
  SILVER_REVENUE: '4000',
  GOLD_REVENUE: '4010',
  DIAMOND_REVENUE: '4020',
  REFUNDS_EXPENSE: '6000',
} as const;

export async function getAccountByCode(code: string, tx: Tx = db) {
  return tx.account.findFirst({ where: { code } });
}

export function planRevenueCode(planType: string): string {
  switch (planType) {
    case 'SILVER':
      return ACCOUNT_CODE.SILVER_REVENUE;
    case 'GOLD':
      return ACCOUNT_CODE.GOLD_REVENUE;
    case 'DIAMOND':
      return ACCOUNT_CODE.DIAMOND_REVENUE;
    default:
      throw Object.assign(new Error('Invalid plan type.'), { status: 400 });
  }
}

export function paymentAccountCode(paymentMode: string): string {
  return paymentMode === 'CASH' ? ACCOUNT_CODE.CASH : ACCOUNT_CODE.BANK;
}

// =============================
// Expense categories
// =============================

export const EXPENSE_CATEGORY_ACCOUNT: Record<string, string> = {
  Payroll: '5000',
  Verification: '5100',
  Technology: '5200',
  Rent: '5300',
  Marketing: '5400',
  Travel: '5500',
  Utilities: '5600',
  Supplies: '5700',
  Professional: '5800',
  Banking: '5900',
  Refunds: '6000',
  Other: '5700',
};

export const EXPENSE_CATEGORIES = [
  'Payroll',
  'Verification',
  'Technology',
  'Rent',
  'Marketing',
  'Travel',
  'Utilities',
  'Supplies',
  'Professional',
  'Banking',
  'Other',
];

// =============================
// Company settings
// =============================

export const DEFAULT_SETTINGS = {
  companyName: 'MyBuddyMaid',
  companyTagline: 'Domestic Help Placement Platform',
  gstin: '',
  address: 'C/o Kanchan Bhatiya, 2-A/3 SF, Front Side, Asif Ali Road, Darya Ganj, New Delhi 110002',
  phone: '+91 93551 14869',
  email: 'info@mybuddymaid.in',
  defaultGstRate: 18,
  nonRefundablePortion: 2000,
  supportHours: 'Mon–Sat, 10 AM–7 PM IST',
} as const;

export type SettingsKey = keyof typeof DEFAULT_SETTINGS;

export async function getSettings(): Promise<Record<SettingsKey, string | number>> {
  const rows = await db.setting.findMany();
  const result: Record<string, string | number> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    const key = row.key as SettingsKey;
    if (!(key in DEFAULT_SETTINGS)) continue;
    const fallback = DEFAULT_SETTINGS[key];
    result[key] = typeof fallback === 'number' ? Number(row.value) : row.value;
  }
  return result as Record<SettingsKey, string | number>;
}

export async function upsertSettings(
  values: Partial<Record<SettingsKey, string | number>>,
  tx: Tx = db
) {
  const entries = Object.entries(values).filter(([key]) => key in DEFAULT_SETTINGS);
  for (const [key, value] of entries) {
    await tx.setting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });
  }
  return getSettings();
}

// =============================
// Indian fiscal year helpers (Apr 1 – Mar 31)
// =============================

export function fiscalYearStart(date = new Date()): Date {
  const y = date.getFullYear();
  const fyStart = new Date(y, 3, 1); // Apr 1 of this year
  return date >= fyStart ? fyStart : new Date(y - 1, 3, 1);
}

export function fiscalYearLabel(date = new Date()): string {
  const start = fiscalYearStart(date);
  return `FY ${start.getFullYear()}-${String((start.getFullYear() + 1) % 100).padStart(2, '0')}`;
}

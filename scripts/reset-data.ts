/**
 * Reset — removes ALL transactional/demo data, keeps structural data.
 *
 * Wiped:   journal entries + lines, plan sales, placements, helpers,
 *          customers, expenses, settings overrides
 * Kept:    chart of accounts (30 standard accounts — the structural
 *          skeleton, not business data)
 *
 * After running, the books start at zero. Record real opening balances
 * (cash/bank/equipment) via Journal Entries if you have existing assets.
 *
 * Usage: bun scripts/reset-data.ts
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('Before:', {
    journalEntries: await db.journalEntry.count(),
    journalLines: await db.journalLine.count(),
    planSales: await db.planSale.count(),
    placements: await db.placement.count(),
    helpers: await db.helper.count(),
    customers: await db.customer.count(),
    expenses: await db.expense.count(),
    settings: await db.setting.count(),
    accounts: await db.account.count(),
  });

  // Order matters for FK safety; journal lines cascade with entries,
  // but explicit deletes are clearer and SQLite-safe.
  await db.journalLine.deleteMany();
  await db.journalEntry.deleteMany();
  await db.planSale.deleteMany();
  await db.placement.deleteMany();
  await db.helper.deleteMany();
  await db.customer.deleteMany();
  await db.expense.deleteMany();
  await db.setting.deleteMany(); // defaults (real business profile) apply automatically

  console.log('\nAfter:', {
    journalEntries: await db.journalEntry.count(),
    journalLines: await db.journalLine.count(),
    planSales: await db.planSale.count(),
    placements: await db.placement.count(),
    helpers: await db.helper.count(),
    customers: await db.customer.count(),
    expenses: await db.expense.count(),
    settings: await db.setting.count(),
    accounts: await db.account.count(), // 30 kept — chart of accounts structure
  });

  // sanity: every account balance must now be zero
  const withLines = await db.account.findMany({
    include: { _count: { select: { journalLines: true } } },
  });
  const dirty = withLines.filter((a) => a._count.journalLines > 0);
  console.log(
    dirty.length === 0
      ? '\nAll account balances are ₹0 — books are clean.'
      : `\nWARNING: ${dirty.length} accounts still have journal lines!`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

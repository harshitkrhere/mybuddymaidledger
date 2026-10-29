/**
 * Seed for MyBuddyMaid ERP — domestic help placement platform
 * INR, GST 18%, Silver/Gold/Diamond plans, 8 cities
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const money = (n: number) => Math.round(n * 100) / 100;

// deterministic pseudo-random for stable seeds
let seedState = 42;
function rnd() {
  seedState = (seedState * 1103515245 + 12345) % 2147483648;
  return seedState / 2147483648;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}
function pickWeighted<T extends { w: number }>(arr: T[]): T {
  const total = arr.reduce((s, a) => s + a.w, 0);
  let r = rnd() * total;
  for (const a of arr) {
    r -= a.w;
    if (r <= 0) return a;
  }
  return arr[arr.length - 1];
}

const PLANS = {
  SILVER: { fee: 4999, coverageMonths: 10, maxPlacements: 3 },
  GOLD: { fee: 5999, coverageMonths: 12, maxPlacements: 5 },
  DIAMOND: { fee: 6999, coverageMonths: 18, maxPlacements: 10 },
} as const;

const GST_RATE = 18;

const ACCOUNT_DEFS: [string, string, string, string?][] = [
  ['1000', 'Cash on Hand', 'ASSET', 'CURRENT_ASSET'],
  ['1010', 'Bank Account (Current)', 'ASSET', 'CURRENT_ASSET'],
  ['1100', 'Accounts Receivable', 'ASSET', 'CURRENT_ASSET'],
  ['1200', 'Prepaid Expenses', 'ASSET', 'CURRENT_ASSET'],
  ['1500', 'Equipment (Laptops & Phones)', 'ASSET', 'FIXED_ASSET'],
  ['1510', 'Accumulated Depreciation', 'ASSET', 'FIXED_ASSET'],
  ['2000', 'Accounts Payable', 'LIABILITY', 'CURRENT_LIABILITY'],
  ['2100', 'Salaries Payable', 'LIABILITY', 'CURRENT_LIABILITY'],
  ['2200', 'GST Payable', 'LIABILITY', 'CURRENT_LIABILITY'],
  ['2300', 'Advance from Customers', 'LIABILITY', 'CURRENT_LIABILITY'],
  ['2500', 'Loan Payable', 'LIABILITY', 'LONG_TERM_LIABILITY'],
  ['3000', 'Owner Capital', 'EQUITY', 'PAID_IN_CAPITAL'],
  ['3100', 'Retained Earnings', 'EQUITY', 'RETAINED_EARNINGS'],
  ['3200', 'Owner Draws', 'EQUITY', 'DRAW'],
  ['4000', 'Silver Plan Revenue', 'REVENUE', 'OPERATING_REVENUE'],
  ['4010', 'Gold Plan Revenue', 'REVENUE', 'OPERATING_REVENUE'],
  ['4020', 'Diamond Plan Revenue', 'REVENUE', 'OPERATING_REVENUE'],
  ['4900', 'Other Income', 'REVENUE', 'OTHER_REVENUE'],
  ['5000', 'Staff Salaries', 'EXPENSE', 'PAYROLL'],
  ['5100', 'Verification & Onboarding Costs', 'EXPENSE', 'OPERATING'],
  ['5200', 'Technology & Subscriptions', 'EXPENSE', 'OPERATING'],
  ['5300', 'Office Rent', 'EXPENSE', 'OPERATING'],
  ['5400', 'Marketing & Advertising', 'EXPENSE', 'OPERATING'],
  ['5500', 'Travel & Field Visits', 'EXPENSE', 'OPERATING'],
  ['5600', 'Utilities', 'EXPENSE', 'OPERATING'],
  ['5700', 'Office Supplies', 'EXPENSE', 'OPERATING'],
  ['5800', 'Professional Fees', 'EXPENSE', 'OPERATING'],
  ['5900', 'Bank & Payment Charges', 'EXPENSE', 'OPERATING'],
  ['6000', 'Refunds & Concessions', 'EXPENSE', 'OPERATING'],
  ['6100', 'Depreciation', 'EXPENSE', 'NON_OPERATING'],
];

const CITIES = [
  { name: 'Delhi', localities: ['Hauz Khas', 'Vasant Vihar', 'Rajouri Garden', 'Mayur Vihar', 'Defence Colony', 'Karol Bagh', 'Safdarjung', 'Pitampura'], w: 30 },
  { name: 'Gurgaon', localities: ['DLF Phase 3', 'Sohna Road', 'Golf Course Road', 'Sector 56', 'Sushant Lok'], w: 20 },
  { name: 'Noida', localities: ['Sector 62', 'Sector 137', 'Indirapuram', 'Sector 50'], w: 15 },
  { name: 'Mumbai', localities: ['Powai', 'Bandra West', 'Andheri West', 'Chembur', 'Malad West'], w: 15 },
  { name: 'Pune', localities: ['Kothrud', 'Baner', 'Viman Nagar', 'Aundh'], w: 8 },
  { name: 'Bangalore', localities: ['Whitefield', 'Indiranagar', 'HSR Layout', 'Jayanagar'], w: 8 },
  { name: 'Mangalore', localities: ['Kadri', 'Bejai', 'Hampankatta'], w: 4 },
];

const CUST_FIRST = ['Rohit', 'Meera', 'Anjali', 'Vikram', 'Priya', 'Suresh', 'Kavita', 'Rahul', 'Sneha', 'Deepa', 'Amit', 'Sunita', 'Manish', 'Farah', 'Nisha', 'Arjun', 'Rekha', 'Sanjay', 'Pooja', 'Ashok', 'Lata', 'Nitin', 'Shalini', 'Harish', 'Divya', 'Rakesh', 'Mamta', 'Prakash', 'Swati', 'Ajay', 'Namrata', 'Ritu', 'Sandeep', 'Gauri', 'Vinod', 'Anupama', 'Rajesh', 'Beena', 'Mukesh', 'Sarita', 'Hemant', 'Vandana', 'Yogesh', 'Neelam', 'Dinesh', 'Aparna', 'Girish', 'Shobha', 'Kiran', 'Bhavana'];
const CUST_LAST = ['Kapoor', 'Sharma', 'Malhotra', 'Nair', 'Iyer', 'Joshi', 'Verma', 'Rao', 'Chatterjee', 'Agarwal', 'Gupta', 'Khan', 'Pillai', 'Menon', 'Bansal', 'Saxena', 'Bhatt', 'Trivedi', 'Shetty', 'Reddy', 'Mishra', 'Tiwari', 'Bajaj', 'Chopra', 'Goel', 'Desai', 'Kulkarni', 'Pai', 'Shukla', 'Dubey', 'Ghosh', 'Banerjee', 'Mehta', 'Shah', 'Jain', 'Sethi'];

const HELPER_FEMALE = ['Sunita', 'Geeta', 'Sita', 'Radha', 'Kamla', 'Parvati', 'Munni', 'Chhaya', 'Babita', 'Rekha', 'Shanti', 'Vimla', 'Laxmi', 'Phoolwati', 'Asha', 'Usha', 'Gudiya', 'Rani', 'Saroj', 'Meena', 'Kaushalya', 'Jyoti', 'Nirmala', 'Bholi', 'Anita', 'Poonam', 'Sushma', 'Kiran', 'Nirmala Devi', 'Chanda'];
const HELPER_MALE = ['Rameshwar', 'Ramkishan', 'Bhola', 'Dinesh', 'Mahesh', 'Shyam', 'Gopal', 'Rajendra', 'Munna', 'Kalpanath'];
const HELPER_LAST = ['Devi', 'Kumari', 'Bai', 'Yadav', 'Sharma', 'Singh', 'Paswan', 'Sah', 'Mandal', 'Pal', 'Ram', 'Prasad', 'Thakur', 'Biswas', 'Das', 'Kumhar', 'Soren', 'Tanti'];

const SERVICE_WEIGHTS = [
  { type: 'FULL_TIME_MAID', w: 25 },
  { type: 'PART_TIME_MAID', w: 25 },
  { type: 'COOK', w: 20 },
  { type: 'BABYSITTER', w: 12 },
  { type: 'ELDER_CARE', w: 10 },
  { type: 'DOMESTIC_HELP', w: 8 },
];

const PLAN_WEIGHTS = [
  { type: 'SILVER', w: 35 },
  { type: 'GOLD', w: 45 },
  { type: 'DIAMOND', w: 20 },
];

const SERVICE_RATES: Record<string, number> = {
  FULL_TIME_MAID: 16000,
  PART_TIME_MAID: 4500,
  COOK: 10000,
  BABYSITTER: 14000,
  ELDER_CARE: 15000,
  DOMESTIC_HELP: 5000,
};

const accountByCode: Record<string, string> = {};

async function nextJE() {
  const count = await db.journalEntry.count();
  return `JE-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
}

async function postEntry(
  date: Date,
  memo: string,
  lines: { accountId: string; debit?: number; credit?: number; memo?: string }[],
  reference?: string,
  source = 'MANUAL'
) {
  const d = money(lines.reduce((s, l) => s + (l.debit || 0), 0));
  const c = money(lines.reduce((s, l) => s + (l.credit || 0), 0));
  if (Math.abs(d - c) > 0.005) throw new Error(`Unbalanced: ${memo} D=${d} C=${c}`);
  await db.journalEntry.create({
    data: {
      entryNumber: await nextJE(),
      date,
      memo,
      reference,
      source,
      lines: { create: lines },
    },
  });
}

async function main() {
  console.log('Seeding MyBuddyMaid ERP...');

  await db.journalLine.deleteMany();
  await db.journalEntry.deleteMany();
  await db.placement.deleteMany();
  await db.planSale.deleteMany();
  await db.customer.deleteMany();
  await db.helper.deleteMany();
  await db.expense.deleteMany();
  await db.account.deleteMany();
  await db.setting.deleteMany();

  // 1. accounts
  for (const [code, name, type, subtype] of ACCOUNT_DEFS) {
    const a = await db.account.create({ data: { code, name, type, subtype } });
    accountByCode[code] = a.id;
  }
  console.log(`Created ${ACCOUNT_DEFS.length} accounts`);

  // 2. helpers (~34)
  const helpers: { id: string; serviceType: string; city: string; status: string; name: string }[] = [];
  const usedHelperNames = new Set<string>();
  for (let i = 0; i < 34; i++) {
    const city = pickWeighted(CITIES.map((c) => ({ name: c.name, localities: c.localities, w: c.w })));
    const svc = pickWeighted(SERVICE_WEIGHTS).type;
    const female = ['BABYSITTER', 'ELDER_CARE', 'FULL_TIME_MAID', 'PART_TIME_MAID'].includes(svc) || rnd() > 0.7;
    let name = '';
    let guard = 0;
    do {
      name = `${pick(female ? HELPER_FEMALE : HELPER_MALE)} ${pick(HELPER_LAST)}`;
      guard++;
    } while (usedHelperNames.has(name) && guard < 20);
    usedHelperNames.add(name);

    const statusRoll = rnd();
    const status = statusRoll < 0.42 ? 'VERIFIED' : statusRoll < 0.75 ? 'PLACED' : statusRoll < 0.88 ? 'PENDING' : 'INACTIVE';
    const fullyVerified = status === 'VERIFIED' || status === 'PLACED';

    const h = await db.helper.create({
      data: {
        name,
        phone: `+91 ${String(70000 + Math.floor(rnd() * 29999))} ${String(10000 + Math.floor(rnd() * 89999))}`,
        gender: female ? 'F' : 'M',
        city: city.name,
        locality: pick(city.localities),
        serviceType: svc,
        expectedMonthlyRate: SERVICE_RATES[svc] + Math.floor(rnd() * 4) * 500,
        aadhaarVerified: fullyVerified || (status === 'PENDING' && rnd() > 0.4),
        policeVerified: fullyVerified,
        referenceChecked: fullyVerified || (status === 'PENDING' && rnd() > 0.6),
        status,
        createdAt: new Date(Date.now() - Math.floor(rnd() * 180) * 86400000),
      },
    });
    helpers.push({ id: h.id, serviceType: svc, city: city.name, status, name });
  }
  console.log(`Created ${helpers.length} helpers`);

  // 3. customers + plan sales over last 6 months
  const now = new Date();
  const usedCustNames = new Set<string>();
  let saleSeq = 0;
  const customersWithPlans: { id: string; name: string; maxPlacements: number; serviceType: string }[] = [];

  for (let i = 0; i < 48; i++) {
    const city = pickWeighted(CITIES.map((c) => ({ name: c.name, localities: c.localities, w: c.w })));
    let name = '';
    let guard = 0;
    do {
      name = `${pick(CUST_FIRST)} ${pick(CUST_LAST)}`;
      guard++;
    } while (usedCustNames.has(name) && guard < 30);
    usedCustNames.add(name);

    // purchase month spread over the last 6 months
    const monthsAgo = Math.floor(rnd() * 6);
    const purchaseDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1 + Math.floor(rnd() * 27));
    const planType = pickWeighted(PLAN_WEIGHTS).type;
    const plan = PLANS[planType as keyof typeof PLANS];
    const expiry = new Date(purchaseDate);
    expiry.setMonth(expiry.getMonth() + plan.coverageMonths);

    const cust = await db.customer.create({
      data: {
        name,
        phone: `+91 ${String(90000 + Math.floor(rnd() * 9999))} ${String(10000 + Math.floor(rnd() * 89999))}`,
        email: rnd() > 0.5 ? `${name.split(' ')[0].toLowerCase()}${Math.floor(rnd() * 99)}@${pick(['gmail.com', 'outlook.com', 'yahoo.com'])}` : null,
        city: city.name,
        locality: pick(city.localities),
        planType,
        planFee: plan.fee,
        planPurchaseDate: purchaseDate,
        planExpiryDate: expiry,
        maxPlacements: plan.maxPlacements,
        status: 'ACTIVE',
        createdAt: purchaseDate,
      },
    });

    // plan sale + journal entry
    const fee = plan.fee;
    const gst = money(fee * GST_RATE / 100);
    const total = money(fee + gst);
    const paymentMode = pick(['UPI', 'UPI', 'UPI', 'BANK', 'BANK', 'CARD', 'CASH']);
    saleSeq++;
    await db.planSale.create({
      data: {
        customerId: cust.id,
        planType,
        feeAmount: fee,
        gstRate: GST_RATE,
        gstAmount: gst,
        totalAmount: total,
        paymentMode,
        saleDate: purchaseDate,
      },
    });
    const payAccount = paymentMode === 'CASH' ? accountByCode['1000'] : accountByCode['1010'];
    const revenueCode = planType === 'SILVER' ? '4000' : planType === 'GOLD' ? '4010' : '4020';
    await postEntry(
      purchaseDate,
      `Plan sale — ${planType} (${name}, ${city.name})`,
      [
        { accountId: payAccount, debit: total, memo: `${paymentMode} received` },
        { accountId: accountByCode[revenueCode], credit: fee, memo: `${planType} plan fee` },
        { accountId: accountByCode['2200'], credit: gst, memo: 'GST output @18%' },
      ],
      `SALE-${saleSeq}`,
      'PLAN_SALE'
    );

    customersWithPlans.push({
      id: cust.id,
      name,
      maxPlacements: plan.maxPlacements,
      serviceType: pickWeighted(SERVICE_WEIGHTS).type,
    });
  }
  console.log(`Created 48 customers, ${saleSeq} plan sales`);

  // 4. placements for ~20 customers
  let placementsCreated = 0;
  const placedHelpers = new Set<string>();
  for (const cust of customersWithPlans.slice(0, 22)) {
    const candidate = helpers.find(
      (h) => !placedHelpers.has(h.id) && h.status !== 'INACTIVE' && h.serviceType === cust.serviceType && (h.status === 'VERIFIED' || h.status === 'PLACED')
    );
    if (!candidate) continue;
    placedHelpers.add(candidate.id);

    const startDate = new Date(now.getFullYear(), now.getMonth() - Math.floor(rnd() * 4), 1 + Math.floor(rnd() * 25));
    const rate = SERVICE_RATES[cust.serviceType] + Math.floor(rnd() * 4) * 500;

    const roll = rnd();
    if (roll < 0.6) {
      // active placement
      await db.placement.create({
        data: {
          customerId: cust.id,
          helperId: candidate.id,
          serviceType: cust.serviceType,
          startDate,
          monthlyRate: rate,
          status: 'ACTIVE',
        },
      });
      await db.customer.update({ where: { id: cust.id }, data: { placementsUsed: { increment: 1 } } });
      await db.helper.update({ where: { id: candidate.id }, data: { status: 'PLACED' } });
      placementsCreated++;
    } else if (roll < 0.8) {
      // ended placement (helper left)
      const endDate = new Date(startDate.getTime() + Math.floor(rnd() * 60 + 20) * 86400000);
      await db.placement.create({
        data: {
          customerId: cust.id,
          helperId: candidate.id,
          serviceType: cust.serviceType,
          startDate,
          endDate,
          monthlyRate: rate,
          status: 'ENDED',
          notes: 'Helper moved back to hometown',
        },
      });
      await db.customer.update({ where: { id: cust.id }, data: { placementsUsed: { increment: 1 } } });
      placementsCreated++;
    } else {
      // replaced: original ended + replacement active
      const endDate = new Date(startDate.getTime() + Math.floor(rnd() * 40 + 15) * 86400000);
      await db.placement.create({
        data: {
          customerId: cust.id,
          helperId: candidate.id,
          serviceType: cust.serviceType,
          startDate,
          endDate,
          monthlyRate: rate,
          status: 'REPLACED',
          notes: 'Replaced under plan coverage',
        },
      });
      await db.customer.update({ where: { id: cust.id }, data: { placementsUsed: { increment: 1 } } });
      const replacement = helpers.find(
        (h) => !placedHelpers.has(h.id) && (h.status === 'VERIFIED' || h.status === 'PLACED') && h.serviceType === cust.serviceType
      );
      if (replacement) {
        placedHelpers.add(replacement.id);
        const rStart = new Date(endDate.getTime() + 2 * 86400000);
        await db.placement.create({
          data: {
            customerId: cust.id,
            helperId: replacement.id,
            serviceType: cust.serviceType,
            startDate: rStart,
            monthlyRate: rate,
            status: 'ACTIVE',
            isReplacement: true,
          },
        });
        await db.customer.update({ where: { id: cust.id }, data: { placementsUsed: { increment: 1 } } });
        await db.helper.update({ where: { id: replacement.id }, data: { status: 'PLACED' } });
        placementsCreated++;
      }
    }
  }
  console.log(`Created ${placementsCreated} placements`);

  // 5. monthly expenses (6 months, lean operation)
  const expenseTemplate: { code: string; amount: number; desc: string; category: string; vendor: string; day: number; mode: string }[] = [
    { code: '5000', amount: 28000, desc: 'Staff salaries (coordinator + verification exec)', category: 'Payroll', vendor: 'Payroll', day: 28, mode: 'BANK' },
    { code: '5300', amount: 8000, desc: 'Co-working space rent', category: 'Rent', vendor: 'Innov8 Coworking', day: 3, mode: 'BANK' },
    { code: '5400', amount: 6500, desc: 'Google Ads + local flyers', category: 'Marketing', vendor: 'Google Ads', day: 10, mode: 'CARD' },
    { code: '5100', amount: 2400, desc: 'Police verification & Aadhaar checks (~12 helpers)', category: 'Verification', vendor: 'Verification vendors', day: 15, mode: 'UPI' },
    { code: '5200', amount: 2100, desc: 'App hosting, WhatsApp Business API, CRM', category: 'Technology', vendor: 'AWS / Meta', day: 5, mode: 'CARD' },
    { code: '5500', amount: 1600, desc: 'Field visits — local travel', category: 'Travel', vendor: 'Metro / Ola', day: 20, mode: 'UPI' },
    { code: '5600', amount: 900, desc: 'Electricity, internet & phone', category: 'Utilities', vendor: 'Airtel / BSES', day: 8, mode: 'UPI' },
    { code: '5900', amount: 450, desc: 'Payment gateway & bank charges', category: 'Banking', vendor: 'Razorpay / HDFC', day: 25, mode: 'BANK' },
  ];

  for (let m = 5; m >= 0; m--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - m, 1);
    // opening entry only at month 5 start
    if (m === 5) {
      await postEntry(
        monthStart,
        'Opening balances',
        [
          { accountId: accountByCode['1010'], debit: 350000, memo: 'Bank opening' },
          { accountId: accountByCode['1000'], debit: 8000, memo: 'Cash opening' },
          { accountId: accountByCode['1500'], debit: 90000, memo: 'Laptops & phones' },
          { accountId: accountByCode['2500'], credit: 100000, memo: 'Business loan' },
          { accountId: accountByCode['3000'], credit: 348000, memo: 'Owner capital' },
        ],
        undefined,
        'OPENING'
      );
    }
    for (const e of expenseTemplate) {
      const expDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), e.day);
      const variance = 1 + (rnd() - 0.5) * 0.2;
      const amount = money(e.amount * variance);
      await db.expense.create({
        data: {
          date: expDate,
          description: e.desc,
          amount,
          category: e.category,
          paymentMode: e.mode,
          vendor: e.vendor,
        },
      });
      const payAccount = e.mode === 'CASH' ? accountByCode['1000'] : accountByCode['1010'];
      await postEntry(
        expDate,
        `Expense — ${e.desc}`,
        [
          { accountId: accountByCode[e.code], debit: amount, memo: e.category },
          { accountId: payAccount, credit: amount, memo: `Paid via ${e.mode}` },
        ],
        undefined,
        'EXPENSE'
      );
    }
  }

  // 6. one refund example (2 months ago, Silver)
  const refundCust = customersWithPlans[30];
  if (refundCust) {
    const refundDate = new Date(now.getFullYear(), now.getMonth() - 2, 18);
    const refundable = money(PLANS.SILVER.fee - 2000);
    await db.customer.update({
      where: { id: refundCust.id },
      data: { status: 'REFUNDED', notes: 'Refunded — could not provide 3 profiles within 45 days' },
    });
    const sale = await db.planSale.findFirst({ where: { customerId: refundCust.id }, orderBy: { saleDate: 'desc' } });
    if (sale) {
      await db.planSale.update({
        where: { id: sale.id },
        data: { isRefunded: true, refundAmount: refundable },
      });
    }
    await postEntry(
      refundDate,
      `Refund — Silver plan (${refundCust.name})`,
      [
        { accountId: accountByCode['6000'], debit: refundable, memo: 'Refund of refundable portion' },
        { accountId: accountByCode['1010'], credit: refundable, memo: 'Bank transfer to customer' },
      ],
      'REFUND-1',
      'REFUND'
    );
  }

  // 7. owner draw last month
  await postEntry(
    new Date(now.getFullYear(), now.getMonth() - 1, 25),
    'Owner draw',
    [
      { accountId: accountByCode['3200'], debit: 15000 },
      { accountId: accountByCode['1010'], credit: 15000 },
    ]
  );

  // 8. settings
  await db.setting.create({ data: { key: 'companyName', value: 'MyBuddyMaid' } });
  await db.setting.create({ data: { key: 'currency', value: 'INR' } });

  const counts = {
    accounts: await db.account.count(),
    helpers: await db.helper.count(),
    customers: await db.customer.count(),
    planSales: await db.planSale.count(),
    placements: await db.placement.count(),
    expenses: await db.expense.count(),
    journalEntries: await db.journalEntry.count(),
  };
  console.log('Seed complete:', counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

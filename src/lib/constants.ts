// MyBuddyMaid business constants — shared by server & client

export const GST_RATE = 18; // GST on platform fees (%)
export const NON_REFUNDABLE = 2000; // ₹ non-refundable portion of every plan
export const COMPANY_NAME = 'MyBuddyMaid';

export interface PlanDef {
  name: string;
  fee: number;
  coverMonths: number;
  placementsIncluded: number;
  profilesOffered: number;
  fastTrack?: boolean;
}

export const PLANS: Record<string, PlanDef> = {
  SILVER: { name: 'Silver', fee: 4999, coverMonths: 10, placementsIncluded: 3, profilesOffered: 3 },
  GOLD: { name: 'Gold', fee: 5999, coverMonths: 12, placementsIncluded: 5, profilesOffered: 4 },
  DIAMOND: { name: 'Diamond', fee: 6999, coverMonths: 18, placementsIncluded: 10, profilesOffered: 5, fastTrack: true },
};

export const PLAN_KEYS = ['SILVER', 'GOLD', 'DIAMOND'] as const;

export interface ServiceDef {
  label: string;
  startingSalary: number;
}

export const SERVICE_TYPES: Record<string, ServiceDef> = {
  FULL_TIME_MAID: { label: 'Full-Time Maid', startingSalary: 16000 },
  PART_TIME_MAID: { label: 'Part-Time Maid', startingSalary: 4500 },
  COOK: { label: 'Cook', startingSalary: 10000 },
  NANNY: { label: 'Babysitter / Nanny', startingSalary: 14000 },
  ELDER_CARE: { label: 'Elder Care', startingSalary: 15000 },
  DOMESTIC_HELP: { label: 'Domestic Help', startingSalary: 5000 },
};

export const SERVICE_KEYS = Object.keys(SERVICE_TYPES);

export const CITIES = [
  'Delhi',
  'Noida',
  'Greater Noida',
  'Gurgaon',
  'Mumbai',
  'Pune',
  'Bangalore',
  'Mangalore',
];

// Placement pipeline order
export const PLACEMENT_STATUSES = [
  'REQUESTED',
  'SHORTLISTED',
  'INTERVIEWING',
  'PLACED',
  'COVER_ACTIVE',
  'CLOSED',
] as const;

export const PAYMENT_MODES = ['UPI', 'BANK', 'CARD', 'CASH'] as const;

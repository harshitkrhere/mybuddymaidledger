#!/usr/bin/env node
/**
 * switch-db.mjs — flip the Prisma datasource provider between SQLite (dev)
 * and PostgreSQL (production: Neon / Supabase / Railway / RDS).
 *
 * Usage:
 *   node scripts/switch-db.mjs postgresql   # or: npm run db:use-postgres
 *   node scripts/switch-db.mjs sqlite       # or: npm run db:use-sqlite
 *
 * After switching, always run:
 *   npx prisma generate && npx prisma db push
 *
 * NOTE: DATABASE_URL is NOT touched — set it in .env (local) or in your
 * hosting platform's environment variables (production).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const VALID = ['sqlite', 'postgresql'];
const target = process.argv[2];

if (!VALID.includes(target)) {
  console.error(`Usage: node scripts/switch-db.mjs <${VALID.join('|')}>`);
  process.exit(1);
}

const schemaPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'prisma', 'schema.prisma');
const schema = readFileSync(schemaPath, 'utf8');

const providerRegex = /(datasource\s+\w+\s*\{[^}]*?provider\s*=\s*")([^"]+)(")/s;
if (!providerRegex.test(schema)) {
  console.error('Could not find `provider = "..."` inside the datasource block of prisma/schema.prisma');
  process.exit(1);
}

const current = schema.match(providerRegex)[2];
if (current === target) {
  console.log(`Datasource provider is already "${target}" — nothing to do.`);
  process.exit(0);
}

const updated = schema.replace(providerRegex, `$1${target}$3`);
writeFileSync(schemaPath, updated);

console.log(`Datasource provider switched: "${current}" → "${target}"`);
console.log('\nNext steps:');
console.log('  1. Set DATABASE_URL to your connection string (if not already set).');
if (target === 'postgresql') {
  console.log('     Use the POOLED connection string on Neon/Supabase (host contains "-pooler",');
  console.log('     include ?sslmode=require). Never commit it — set it as a platform env var.');
} else {
  console.log('     e.g. DATABASE_URL=file:/home/z/my-project/db/custom.db');
}
console.log('  2. npx prisma generate');
console.log('  3. npx prisma db push          # create tables');
console.log('  4. npm run db:seed             # load chart of accounts + demo data (fresh DBs only)');

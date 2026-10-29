import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const db = new PrismaClient()

async function main() {
  console.log("Wiping all demo/seed transaction and financial data...")

  // Delete all financial data
  await db.auditLog.deleteMany()
  await db.invoiceItem.deleteMany()
  await db.invoice.deleteMany()
  await db.expense.deleteMany()
  await db.transaction.deleteMany()
  await db.client.deleteMany()

  console.log("All transactions, invoices, expenses, audit logs, and clients cleared to 0.")

  // Clean and ensure default standard categories exist
  await db.category.deleteMany()
  const defaultCategories = [
    { name: "Client Billing", type: "INCOME" },
    { name: "Service Revenue", type: "INCOME" },
    { name: "Consulting", type: "INCOME" },
    { name: "Other Income", type: "INCOME" },
    { name: "Office Rent", type: "EXPENSE" },
    { name: "Salaries & Wages", type: "EXPENSE" },
    { name: "Software & Tools", type: "EXPENSE" },
    { name: "Marketing & Ads", type: "EXPENSE" },
    { name: "Travel & Transport", type: "EXPENSE" },
    { name: "Office Supplies", type: "EXPENSE" },
    { name: "Utilities", type: "EXPENSE" },
    { name: "Other Expense", type: "EXPENSE" },
  ]
  for (const cat of defaultCategories) {
    await db.category.create({ data: cat })
  }
  console.log("Default categories ensured.")

  // Reset CompanySettings
  await db.companySettings.deleteMany()
  await db.companySettings.create({
    data: {
      companyName: "MyBuddyMaid Services",
      currency: "INR",
      taxRate: 18,
      email: "contact@mybuddymaid.com",
      address: "Mumbai, India",
    },
  })
  console.log("Company settings reset to clean default.")

  // Ensure primary users exist so the user can log in
  const redPassword = process.env.SEED_PASSWORD_RED || "dxz0TudgI4iwtpHV1xR!"
  const adminPassword = process.env.SEED_PASSWORD_ADMIN || "RKRXXiu41EJsDrYP2nA!"
  const managerPassword = process.env.SEED_PASSWORD_MANAGER || "Fq4K3Z639xewZWEG3gM!"
  const employeePassword = process.env.SEED_PASSWORD_EMPLOYEE || "4uV3yqYNnSNHjryw4yE!"

  const redHash = await bcrypt.hash(redPassword, 10)
  const adminHash = await bcrypt.hash(adminPassword, 10)
  const managerHash = await bcrypt.hash(managerPassword, 10)
  const employeeHash = await bcrypt.hash(employeePassword, 10)

  // Upsert Harshit / Red account
  await db.user.deleteMany()
  await db.user.create({
    data: {
      name: "Harshit",
      email: "red@mybuddymaid.com",
      passwordHash: redHash,
      role: "RED",
      status: "ACTIVE",
      title: "Owner / Director",
    },
  })
  await db.user.create({
    data: {
      name: "Admin",
      email: "admin@mybuddymaid.com",
      passwordHash: adminHash,
      role: "ADMIN",
      status: "ACTIVE",
      title: "Finance Admin",
    },
  })
  await db.user.create({
    data: {
      name: "Manager",
      email: "manager@mybuddymaid.com",
      passwordHash: managerHash,
      role: "MANAGER",
      status: "ACTIVE",
      title: "Operations Manager",
    },
  })
  await db.user.create({
    data: {
      name: "Employee",
      email: "employee@mybuddymaid.com",
      passwordHash: employeeHash,
      role: "EMPLOYEE",
      status: "ACTIVE",
      title: "Staff Member",
    },
  })

  // Purge any old sessions so clean login happens
  await db.session.deleteMany()

  console.log("Database reset complete. All ledger data is 0. Ready for real production data!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())

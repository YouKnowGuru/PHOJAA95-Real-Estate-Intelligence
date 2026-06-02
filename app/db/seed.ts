import "dotenv/config";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import * as schema from "./schema";
import * as relations from "./relations";
import { resolveDatabaseUrl } from "./connection-url";
import { DEFAULT_SITE_TAGLINE } from "../contracts/constants";

const fullSchema = { ...schema, ...relations };

async function propertiesEmpty(db: any): Promise<boolean> {
  const rows = await db.select({ count: sql<number>`count(*)` }).from(schema.properties);
  return Number(rows[0]?.count ?? 0) === 0;
}

async function seed() {
  const pool = mysql.createPool({
    uri: resolveDatabaseUrl(),
    connectionLimit: 10,
  });

  const db = drizzle(pool, { mode: "planetscale", schema: fullSchema });

  console.log("Seeding database...");

  // ─── 1. PROPERTY TYPES ───────────────────────────────────────────
  const propertyTypeData = [
    { name: "Land", description: "Agricultural and non-agricultural land plots", requiresBuildingDocs: false },
    { name: "Building", description: "Commercial and residential buildings", requiresBuildingDocs: true },
    { name: "Apartment", description: "Multi-unit residential apartments", requiresBuildingDocs: true },
    { name: "Flat", description: "Single-level residential units", requiresBuildingDocs: true },
    { name: "Duplex", description: "Two-story residential units", requiresBuildingDocs: true },
    { name: "Bungalow", description: "Single-story detached houses", requiresBuildingDocs: true },
  ];

  for (const pt of propertyTypeData) {
    await db.insert(schema.propertyTypes).values(pt).onDuplicateKeyUpdate({
      set: { name: sql`values(name)` },
    });
  }
  console.log("Property types seeded.");

  // ─── 2. LOCAL USERS (Admin + Staff) ──────────────────────────────
  const adminPassword = await bcrypt.hash("Admin@123!", 12);
  const staffPassword = await bcrypt.hash("Staff@123!", 12);

  await db.insert(schema.localUsers).values([
    {
      fullName: "Admin User",
      email: "admin@phojaa95.com",
      password: adminPassword,
      role: "admin",
      phone: "+975-17123456",
      address: "Thimphu, Bhutan",
      status: "active",
      loginAttempts: 0,
    },
    {
      fullName: "Karma Dorji",
      email: "karma@phojaa95.com",
      password: staffPassword,
      role: "staff",
      phone: "+975-17234567",
      address: "Thimphu, Bhutan",
      status: "active",
      loginAttempts: 0,
    },
    {
      fullName: "Pema Wangchuk",
      email: "pema@phojaa95.com",
      password: staffPassword,
      role: "staff",
      phone: "+975-17345678",
      address: "Paro, Bhutan",
      status: "active",
      loginAttempts: 0,
    },
    {
      fullName: "Sonam Choden",
      email: "sonam@phojaa95.com",
      password: staffPassword,
      role: "staff",
      phone: "+975-17456789",
      address: "Punakha, Bhutan",
      status: "active",
      loginAttempts: 0,
    },
  ]).onDuplicateKeyUpdate({
    set: {
      email: sql`values(email)`,
      password: sql`values(password)`,
      status: sql`values(status)`,
      loginAttempts: sql`values(login_attempts)`,
    },
  });
  console.log("Users seeded (admin@phojaa95.com / Admin@123!, staff / Staff@123!).");

  // ─── 3. SYSTEM SETTINGS (branding + app config) ─────────────────
  await db.insert(schema.systemSettings).values([
    { key: "site_name", value: "PHOJAA95", description: "Public site / company name" },
    { key: "site_tagline", value: DEFAULT_SITE_TAGLINE, description: "Login page footer" },
    { key: "site_logo", value: "", description: "Site logo URL" },
    { key: "company_name", value: "Phojaa95 Real Estate", description: "Company name displayed in the system" },
    { key: "commission_rate", value: "3", description: "Default commission rate percentage" },
    { key: "currency", value: "BTN", description: "Default currency code" },
  ]).onDuplicateKeyUpdate({
    set: { value: sql`values(value)` },
  });
  console.log("System settings seeded.");

  if (!(await propertiesEmpty(db))) {
    console.log("Sample properties already exist — skipping demo properties, attendance, payroll, and history.");
    await pool.end();
    console.log("Seed completed (core data only).");
    return;
  }

  // ─── 4. SAMPLE PROPERTIES ────────────────────────────────────────
  const sampleProperties = [
    {
      propertyName: "Sunset Valley Residence",
      propertyTypeId: 6,
      address: "Motithang, Thimphu",
      latitude: "27.4728",
      longitude: "89.6390",
      ownerName: "Dorji Wangdi",
      ownerCID: "10704001234",
      ownerPhone: "+975-17567890",
      ownerAddress: "Motithang, Thimphu",
      sellingPrice: "8500000.00",
      realEstateFee: "255000.00",
      currentStep: 5,
      approvalStatus: "completed" as const,
      workflowStatus: "completed" as const,
      listedById: 2,
    },
    {
      propertyName: "Riverfront Commercial Complex",
      propertyTypeId: 2,
      address: "Changlimithang, Thimphu",
      latitude: "27.4712",
      longitude: "89.6330",
      ownerName: "Tshering Dema",
      ownerCID: "10703005678",
      ownerPhone: "+975-17678901",
      ownerAddress: "Changlimithang, Thimphu",
      sellingPrice: "15000000.00",
      realEstateFee: "450000.00",
      currentStep: 3,
      approvalStatus: "pending_review" as const,
      workflowStatus: "processing" as const,
      listedById: 3,
    },
    {
      propertyName: "Hillside Agricultural Land",
      propertyTypeId: 1,
      address: "Lobesa, Punakha",
      latitude: "27.5920",
      longitude: "89.8765",
      ownerName: "Ugyen Dorji",
      ownerCID: "10602008901",
      ownerPhone: "+975-17789012",
      ownerAddress: "Lobesa, Punakha",
      sellingPrice: "3200000.00",
      realEstateFee: "96000.00",
      currentStep: 2,
      approvalStatus: "pending_review" as const,
      workflowStatus: "processing" as const,
      listedById: 4,
    },
    {
      propertyName: "Modern City Apartment",
      propertyTypeId: 3,
      address: "Olakha, Thimphu",
      latitude: "27.3170",
      longitude: "89.6335",
      ownerName: "Kinley Pem",
      ownerCID: "10801002345",
      ownerPhone: "+975-17890123",
      ownerAddress: "Olakha, Thimphu",
      sellingPrice: "5600000.00",
      realEstateFee: "168000.00",
      currentStep: 1,
      approvalStatus: "submitted" as const,
      workflowStatus: "pending" as const,
      listedById: 2,
    },
    {
      propertyName: "Lakeside Duplex Villa",
      propertyTypeId: 5,
      address: "Lungtenphu, Thimphu",
      latitude: "27.4420",
      longitude: "89.6110",
      ownerName: "Sangay Tenzin",
      ownerCID: "10506006789",
      ownerPhone: "+975-17901234",
      ownerAddress: "Lungtenphu, Thimphu",
      sellingPrice: "12000000.00",
      realEstateFee: "360000.00",
      currentStep: 4,
      approvalStatus: "approved" as const,
      workflowStatus: "processing" as const,
      listedById: 3,
    },
    {
      propertyName: "Valley View Flat",
      propertyTypeId: 4,
      address: "Taba, Thimphu",
      latitude: "27.5020",
      longitude: "89.6120",
      ownerName: "Chimi Yangden",
      ownerCID: "10908003456",
      ownerPhone: "+975-17012345",
      ownerAddress: "Taba, Thimphu",
      sellingPrice: "4300000.00",
      realEstateFee: "129000.00",
      currentStep: 2,
      approvalStatus: "approved" as const,
      workflowStatus: "processing" as const,
      listedById: 4,
    },
    {
      propertyName: "Mountain Retreat Bungalow",
      propertyTypeId: 6,
      address: "Paro Town, Paro",
      latitude: "27.4280",
      longitude: "89.4160",
      ownerName: "Lhaba Tshering",
      ownerCID: "10407007890",
      ownerPhone: "+975-17123456",
      ownerAddress: "Paro Town, Paro",
      sellingPrice: "9800000.00",
      realEstateFee: "294000.00",
      currentStep: 5,
      approvalStatus: "completed" as const,
      workflowStatus: "completed" as const,
      listedById: 2,
    },
    {
      propertyName: "Downtown Commercial Building",
      propertyTypeId: 2,
      address: "Norzin Lam, Thimphu",
      latitude: "27.4750",
      longitude: "89.6400",
      ownerName: "Wangda Gyeltshen",
      ownerCID: "10309004567",
      ownerPhone: "+975-17234567",
      ownerAddress: "Norzin Lam, Thimphu",
      sellingPrice: "25000000.00",
      realEstateFee: "750000.00",
      currentStep: 3,
      approvalStatus: "rejected" as const,
      workflowStatus: "processing" as const,
      listedById: 3,
      rejectionComments: "Occupancy certificate is expired. Please provide updated document.",
    },
  ];

  for (const prop of sampleProperties) {
    await db.insert(schema.properties).values(prop);
  }
  console.log("Properties seeded.");

  // ─── 5. ATTENDANCE ───────────────────────────────────────────────
  const today = new Date();
  const attendanceData = [];

  for (let i = 0; i < 15; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];

    for (const userId of [2, 3, 4]) {
      const statuses = ["present", "present", "present", "late", "absent", "half_day"];
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      const checkInDate = new Date(dateStr);
      const checkOutDate = new Date(dateStr);
      attendanceData.push({
        userId,
        date: dateStr,
        checkIn: status !== "absent" ? new Date(checkInDate.setHours(8 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 60))) : null,
        checkOut: status !== "absent" ? new Date(checkOutDate.setHours(17, Math.floor(Math.random() * 60))) : null,
        status: status as "present" | "absent" | "late" | "half_day",
      });
    }
  }

  for (const att of attendanceData) {
    await db.insert(schema.attendance).values({
      ...att,
      date: new Date(att.date),
    });
  }
  console.log("Attendance seeded.");

  // ─── 6. PAYROLL ──────────────────────────────────────────────────
  const payrollData = [];
  const months = ["2026-01", "2026-02", "2026-03", "2026-04"];

  for (const userId of [2, 3, 4]) {
    for (const month of months) {
      const baseSalary = 30000 + Math.floor(Math.random() * 20000);
      const bonus = Math.floor(Math.random() * 5000);
      const deduction = Math.floor(Math.random() * 2000);
      const netSalary = baseSalary + bonus - deduction;

      payrollData.push({
        userId,
        month,
        baseSalary: baseSalary.toFixed(2),
        bonus: bonus.toFixed(2),
        deduction: deduction.toFixed(2),
        netSalary: netSalary.toFixed(2),
        paymentStatus: (month === "2026-04" ? "pending" : "paid") as "pending" | "paid",
        paidAt: month !== "2026-04" ? new Date(`${month}-28`) : null,
        notes: `Monthly salary for ${month}`,
      });
    }
  }

  for (const pay of payrollData) {
    await db.insert(schema.payroll).values(pay);
  }
  console.log("Payroll seeded.");

  // ─── 7. APPROVAL HISTORY ─────────────────────────────────────────
  const historyData = [
    { propertyId: 1, step: 1, action: "submitted" as const, adminId: 2, comments: "Property information submitted" },
    { propertyId: 1, step: 1, action: "approved" as const, adminId: 1, comments: "All details verified" },
    { propertyId: 1, step: 2, action: "submitted" as const, adminId: 2, comments: "Agreement and payment uploaded" },
    { propertyId: 1, step: 2, action: "approved" as const, adminId: 1, comments: "Documents verified" },
    { propertyId: 1, step: 3, action: "submitted" as const, adminId: 2, comments: "Property documents uploaded" },
    { propertyId: 1, step: 3, action: "approved" as const, adminId: 1, comments: "All building documents verified" },
    { propertyId: 1, step: 4, action: "submitted" as const, adminId: 2, comments: "Verification in progress" },
    { propertyId: 1, step: 4, action: "approved" as const, adminId: 1, comments: "Both processes completed" },
    { propertyId: 1, step: 5, action: "submitted" as const, adminId: 2, comments: "Final documents uploaded" },
    { propertyId: 1, step: 5, action: "completed" as const, adminId: 1, comments: "Property sale completed" },
  ];

  for (const hist of historyData) {
    await db.insert(schema.approvalHistory).values(hist);
  }
  console.log("Approval history seeded.");

  // ─── 8. ACTIVITY LOGS ────────────────────────────────────────────
  const activityData = [
    { userId: 1, userName: "Admin User", action: "LOGIN", entityType: "system", metadata: { ip: "192.168.1.1" } },
    { userId: 2, userName: "Karma Dorji", action: "PROPERTY_CREATED", entityType: "property", entityId: 1, metadata: { propertyName: "Sunset Valley Residence" } },
    { userId: 1, userName: "Admin User", action: "PROPERTY_APPROVED", entityType: "property", entityId: 1, metadata: { step: 1 } },
    { userId: 3, userName: "Pema Wangchuk", action: "PROPERTY_CREATED", entityType: "property", entityId: 2, metadata: { propertyName: "Riverfront Commercial Complex" } },
    { userId: 1, userName: "Admin User", action: "STAFF_CREATED", entityType: "user", entityId: 4, metadata: { staffName: "Sonam Choden" } },
  ];

  for (const act of activityData) {
    await db.insert(schema.activityLogs).values(act);
  }
  console.log("Activity logs seeded.");

  await pool.end();
  console.log("Seed completed successfully!");
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});

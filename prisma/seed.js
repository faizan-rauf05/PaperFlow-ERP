require("dotenv/config");
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  const prismaUrl = process.env.PRISMA_URL;
  if (prismaUrl && (!databaseUrl || databaseUrl.startsWith("prisma+")))
    return prismaUrl;
  return databaseUrl || prismaUrl || "";
}

const pool = new Pool({ connectionString: getDatabaseUrl() });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TEST_USERS = [
  { email: "admin@factory.com", name: "Admin User", role: "ADMIN" },
  { email: "manager@factory.com", name: "Manager User", role: "MANAGER" },
  { email: "worker@factory.com", name: "Worker User", role: "WORKER" },
  { email: "sales@factory.com", name: "Sales User", role: "SALES" },
  { email: "finance@factory.com", name: "Finance User", role: "FINANCE" },
  { email: "warehouse@factory.com", name: "Warehouse User", role: "WAREHOUSE" },
];

const PASSWORD = "Admin1234!";

const MACHINES = [
  { machineCode: "SLIT-01", name: "Slitting Machine 1", stageType: "SLITTING" },
  { machineCode: "FLEXO-01", name: "Flexo Printer 1", stageType: "PRINTING" },
  {
    machineCode: "HANDLE-01",
    name: "Handle Make & Paste 1",
    stageType: "HANDLE_MAKING_PASTING",
  },
  { machineCode: "PACK-01", name: "Packing Line 1", stageType: "PACKING" },
];

const DEFECT_CATEGORIES = [
  { code: "PRINT", name: "Print defects" },
  { code: "MATERIAL", name: "Material defects" },
  { code: "HANDLE", name: "Handle defects" },
];

const DEFECTS = [
  {
    stageType: "PRINT_QC",
    code: "MISALIGNMENT",
    description: "Print misalignment",
    categoryCode: "PRINT",
  },
  {
    stageType: "PRINT_QC",
    code: "SMUDGE",
    description: "Ink smudge",
    categoryCode: "PRINT",
  },
  {
    stageType: "QUALITY_CHECK",
    code: "SIZE_VAR",
    description: "Size variation",
    categoryCode: "MATERIAL",
  },
  {
    stageType: "QUALITY_CHECK",
    code: "HANDLE_DEF",
    description: "Handle defect",
    categoryCode: "HANDLE",
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  for (const user of TEST_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        passwordHash,
        isActive: true,
      },
      create: { ...user, passwordHash, isActive: true },
    });
    console.log(`Seeded ${user.role}: ${user.email}`);
  }

  for (const m of MACHINES) {
    await prisma.machine.upsert({
      where: { machineCode: m.machineCode },
      update: m,
      create: m,
    });
  }
  console.log("Seeded machines");

  const categories = {};
  for (const c of DEFECT_CATEGORIES) {
    const cat = await prisma.defectCategory.upsert({
      where: { code: c.code },
      update: { name: c.name },
      create: c,
    });
    categories[c.code] = cat.id;
  }

  for (const d of DEFECTS) {
    await prisma.defectType.upsert({
      where: { stageType_code: { stageType: d.stageType, code: d.code } },
      update: {
        description: d.description,
        categoryId: categories[d.categoryCode] || null,
      },
      create: {
        stageType: d.stageType,
        code: d.code,
        description: d.description,
        categoryId: categories[d.categoryCode] || null,
      },
    });
  }
  console.log("Seeded defect types");

  const customer = await prisma.customer.upsert({
    where: { id: "seed-customer-metro" },
    update: { name: "Metro Mart" },
    create: {
      id: "seed-customer-metro",
      name: "Metro Mart",
      phone: "+1-555-0100",
      email: "orders@metromart.example",
    },
  });
  console.log(`Seeded customer: ${customer.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

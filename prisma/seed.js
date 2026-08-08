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
];

const PASSWORD = "Admin1234!";

// const MATERIALS = [
//   {
//     materialType: "PAPER_ROLL",
//     code: "PAPER-BRN-80-1200",
//     name: "Brown Paper 80gsm 1200mm",
//     supplier: "PaperCo Ltd",
//     unit: "METER",
//     paperType: "BROWN",
//     paperLengthM: 10000,
//     paperWidthMm: 1200,
//     gsm: 80,
//     kgPerMeter: 0.12,
//     minimumStock: 500,
//   },
//   {
//     materialType: "GLUE",
//     code: "GLUE-HOT-25",
//     name: "Hot Glue 25kg",
//     supplier: "Adhesive Supplies",
//     unit: "KG",
//     glueType: "HOT",
//     weightKg: 25,
//     minimumStock: 50,
//   },
//   {
//     materialType: "GLUE",
//     code: "GLUE-COLD-25",
//     name: "Cold Glue 25kg",
//     supplier: "Adhesive Supplies",
//     unit: "KG",
//     glueType: "COLD",
//     weightKg: 25,
//     minimumStock: 50,
//   },
//   {
//     materialType: "ROPE",
//     code: "ROPE-WHT-100-2",
//     name: "White Rope 100m 2kg",
//     supplier: "Handle Materials Co",
//     unit: "PCS",
//     ropeColor: "WHITE",
//     ropeLengthM: 100,
//     minimumStock: 1000,
//   },
// ];

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

  // for (const m of MATERIALS) {
  //   await prisma.material.upsert({
  //     where: { code: m.code },
  //     update: m,
  //     create: m,
  //   });
  // }
  // console.log("Seeded materials");

  // const kraft = await prisma.material.findUnique({
  //   where: { code: "PAPER-BRN-80-1200" },
  // });
  // const glueHot = await prisma.material.findUnique({
  //   where: { code: "GLUE-HOT-25" },
  // });
  // const glueCold = await prisma.material.findUnique({
  //   where: { code: "GLUE-COLD-25" },
  // });
  // const handleRope = await prisma.material.findUnique({
  //   where: { code: "ROPE-WHT-100-2" },
  // });

  // for (const [code, mat, qty, id, unit] of [
  //   ["PAPER-BRN-80-1200", kraft, 10000, "seed-tx-paper", "METER"],
  //   ["GLUE-HOT-25", glueHot, 100, "seed-tx-glue-hot", "KG"],
  //   ["GLUE-COLD-25", glueCold, 100, "seed-tx-glue-cold", "KG"],
  //   ["ROPE-WHT-100-2", handleRope, 10000, "seed-tx-handle-rope", "PCS"],
  // ]) {
  //   if (!mat) continue;
  //   await prisma.inventoryTransaction.upsert({
  //     where: { id },
  //     update: {},
  //     create: {
  //       id,
  //       materialId: mat.id,
  //       transactionType: "STOCK_IN",
  //       quantity: qty,
  //       unit,
  //       remarks: `Initial ${code} stock`,
  //     },
  //   });
  // }
  // console.log("Seeded material stock (no rolls)");

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
    update: { name: "Metro Mart", kind: "COMPANY" },
    create: {
      id: "seed-customer-metro",
      name: "Metro Mart",
      kind: "COMPANY",
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

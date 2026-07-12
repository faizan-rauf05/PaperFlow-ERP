require("dotenv/config");
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  const prismaUrl = process.env.PRISMA_URL;
  if (prismaUrl && (!databaseUrl || databaseUrl.startsWith("prisma+"))) return prismaUrl;
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

const MATERIALS = [
  {
    materialType: "PAPER_ROLL",
    code: "PAPER-BRN-80-1200",
    name: "Brown Paper 80gsm 1200mm 10000m",
    supplier: "PaperCo Ltd",
    unit: "METER",
    paperType: "BROWN",
    paperLengthM: 10000,
    paperWidthMm: 1200,
    gsm: 80,
    kgPerMeter: 0.12,
  },
  {
    materialType: "GLUE",
    code: "GLUE-HOT-25",
    name: "Hot Glue 25kg",
    supplier: "Adhesive Supplies",
    unit: "KG",
    glueType: "HOT",
    weightKg: 25,
  },
  {
    materialType: "GLUE",
    code: "GLUE-COLD-25",
    name: "Cold Glue 25kg",
    supplier: "Adhesive Supplies",
    unit: "KG",
    glueType: "COLD",
    weightKg: 25,
  },
  {
    materialType: "ROPE",
    code: "ROPE-WHT-100-2",
    name: "White Rope 100m 2kg",
    supplier: "Handle Materials Co",
    unit: "METER",
    ropeColor: "WHITE",
    ropeLengthM: 100,
    ropeWeightKg: 2,
  },
];

const MACHINES = [
  { machineCode: "FLEXO-01", name: "Flexo Printer 1", stageType: "PRINTING" },
  { machineCode: "SLIT-01", name: "Slitting Machine 1", stageType: "SLITTING" },
  { machineCode: "BAG-01", name: "Bag Machine 1", stageType: "BAG_MAKING" },
  { machineCode: "HANDLE-01", name: "Handle Machine 1", stageType: "HANDLE_MAKING" },
  { machineCode: "PASTE-01", name: "Handle Pasting Machine 1", stageType: "HANDLE_PASTING" },
];

const DEFECT_CATEGORIES = [
  { code: "PRINT", name: "Print defects" },
  { code: "MATERIAL", name: "Material defects" },
  { code: "HANDLE", name: "Handle defects" },
];

const DEFECTS = [
  { stageType: "PRINT_QC", code: "MISALIGNMENT", description: "Print misalignment", categoryCode: "PRINT" },
  { stageType: "PRINT_QC", code: "SMUDGE", description: "Ink smudge", categoryCode: "PRINT" },
  { stageType: "PRINT_QC", code: "COLOR_SHIFT", description: "Color shift", categoryCode: "PRINT" },
  { stageType: "FINAL_QC", code: "SIZE_VAR", description: "Size variation", categoryCode: "MATERIAL" },
  { stageType: "FINAL_QC", code: "HANDLE_DEF", description: "Handle defect", categoryCode: "HANDLE" },
];

const STAGE_PIPELINE = [
  { type: "RAW_MATERIAL", in: "METER", out: "METER" },
  { type: "PRINTING", in: "METER", out: "METER" },
  { type: "PRINT_QC", in: "METER", out: "METER" },
  { type: "SLITTING", in: "METER", out: "METER" },
  { type: "BAG_MAKING", in: "METER", out: "BAG" },
  { type: "HANDLE_MAKING", in: "PCS", out: "PCS" },
  { type: "HANDLE_PASTING", in: "BAG", out: "BAG" },
  { type: "FINAL_QC", in: "BAG", out: "BAG" },
  { type: "PACKING", in: "BAG", out: "CARTON" },
  { type: "DISPATCH", in: "CARTON", out: "CARTON" },
];

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  for (const user of TEST_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, passwordHash, isActive: true },
      create: { ...user, passwordHash, isActive: true },
    });
    console.log(`Seeded ${user.role}: ${user.email}`);
  }

  for (const m of MATERIALS) {
    await prisma.material.upsert({
      where: { code: m.code },
      update: m,
      create: m,
    });
  }
  console.log("Seeded materials");

  const kraft = await prisma.material.findUnique({ where: { code: "PAPER-BRN-80-1200" } });
  const glueHot = await prisma.material.findUnique({ where: { code: "GLUE-HOT-25" } });
  const glueCold = await prisma.material.findUnique({ where: { code: "GLUE-COLD-25" } });
  const handleRope = await prisma.material.findUnique({ where: { code: "ROPE-WHT-100-2" } });

  const roll = await prisma.paperRoll.upsert({
    where: { rollNo: "ROLL-2026-001" },
    update: {
      barcode: "ROLL-2026-001",
      materialId: kraft.id,
      remainingWeightKg: 1200,
    },
    create: {
      rollNo: "ROLL-2026-001",
      barcode: "ROLL-2026-001",
      materialId: kraft.id,
      supplier: "PaperCo Ltd",
      batchLot: "LOT-2401",
      gsm: 80,
      widthMm: 1200,
      weightKg: 1200,
      lengthM: 10000,
      remainingLengthM: 10000,
      remainingWeightKg: 1200,
      storageLocation: "Warehouse A-12",
      status: "AVAILABLE",
    },
  });

  await prisma.inventoryTransaction.upsert({
    where: { id: "seed-tx-roll-001" },
    update: {},
    create: {
      id: "seed-tx-roll-001",
      materialId: kraft.id,
      rollId: roll.id,
      transactionType: "STOCK_IN",
      quantity: 10000,
      unit: "METER",
      referenceId: roll.id,
      remarks: "Initial roll stock",
    },
  });
  console.log("Seeded demo roll");

  const legacyCodes = ["KRAFT-BRN", "PAPER-WHT", "GLUE-SIDE", "GLUE-BTM", "HANDLE-ROPE"];
  await prisma.material.deleteMany({ where: { code: { in: legacyCodes } } });

  for (const [code, mat, qty, id] of [
    ["GLUE-HOT-25", glueHot, 100, "seed-tx-glue-hot"],
    ["GLUE-COLD-25", glueCold, 100, "seed-tx-glue-cold"],
    ["ROPE-WHT-100-2", handleRope, 10000, "seed-tx-handle-rope"],
  ]) {
    await prisma.inventoryTransaction.upsert({
      where: { id },
      update: {},
      create: {
        id,
        materialId: mat.id,
        transactionType: "STOCK_IN",
        quantity: qty,
        unit: mat.unit,
        remarks: `Initial ${code} stock`,
      },
    });
  }
  console.log("Seeded glue and handle rope stock");

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
  console.log("Seeded defect categories");

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

  const bagSpec = await prisma.bagSpecification.upsert({
    where: { code: "BAG-STD-01" },
    update: {
      handlesPerBag: 2,
      sideGlueKgPerBag: 0.002,
      bottomGlueKgPerBag: 0.001,
    },
    create: {
      name: "Standard Kraft Bag 8x10",
      code: "BAG-STD-01",
      bagWidthMm: 200,
      repeatLengthMm: 400,
      bagsPerMeter: 2.5,
      handlesPerBag: 2,
      sideGlueKgPerBag: 0.002,
      bottomGlueKgPerBag: 0.001,
      description: "Standard grocery bag",
    },
  });

  const existingOrder = await prisma.productionOrder.findUnique({ where: { orderNo: "PO-2026-0001" } });
  if (!existingOrder) {
    const order = await prisma.productionOrder.create({
      data: {
        orderNo: "PO-2026-0001",
        customer: "Metro Mart",
        bagSpecId: bagSpec.id,
        plannedQty: 10000,
        status: "PENDING",
      },
    });

    for (let i = 0; i < STAGE_PIPELINE.length; i++) {
      const s = STAGE_PIPELINE[i];
      await prisma.productionStage.create({
        data: {
          orderId: order.id,
          stageType: s.type,
          sequence: i + 1,
          status: i === 0 ? "READY" : "PENDING",
          inputUnit: s.in,
          outputUnit: s.out,
        },
      });
    }
    console.log("Seeded demo production order PO-2026-0001");
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });

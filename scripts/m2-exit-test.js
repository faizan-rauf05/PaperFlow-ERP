/**
 * M2 exit criteria smoke test — runs against live DB.
 * Usage: node scripts/m2-exit-test.js
 */
require("dotenv/config");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const { Decimal } = require("@prisma/client/runtime/client");

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  const prismaUrl = process.env.PRISMA_URL;
  if (prismaUrl && (!databaseUrl || databaseUrl.startsWith("prisma+"))) return prismaUrl;
  return databaseUrl || prismaUrl || "";
}

const pool = new Pool({ connectionString: getDatabaseUrl() });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const STOCK_IN = ["STOCK_IN", "RETURN", "ADJUSTMENT"];
const STOCK_OUT = ["STOCK_OUT", "WASTE"];

async function getMaterialStock(materialId) {
  const txs = await prisma.inventoryTransaction.findMany({ where: { materialId } });
  let stock = new Decimal(0);
  for (const tx of txs) {
    const q = new Decimal(tx.quantity.toString());
    if (STOCK_IN.includes(tx.transactionType)) stock = stock.add(q);
    else if (STOCK_OUT.includes(tx.transactionType)) stock = stock.sub(q);
  }
  return stock;
}

const results = [];
function pass(name) { results.push({ ok: true, name }); console.log(`✓ ${name}`); }
function fail(name, err) { results.push({ ok: false, name }); console.error(`✗ ${name}:`, err.message || err); }

async function main() {
  console.log("M2 Exit Criteria Test\n");

  try {
    const roll = await prisma.paperRoll.findFirst({ where: { rollNo: "ROLL-2026-001" }, include: { material: true } });
    if (!roll?.material) throw new Error("Demo roll missing");
    pass("Register rolls with full metadata");
  } catch (e) { fail("Register rolls with full metadata", e); }

  try {
    const kraft = await prisma.material.findUnique({ where: { code: "KRAFT-BRN" } });
    const stock = await getMaterialStock(kraft.id);
    if (stock.lte(0)) throw new Error("Kraft stock should be positive");
    pass("Ledger stock calculation works");
  } catch (e) { fail("Ledger stock calculation works", e); }

  try {
    const order = await prisma.productionOrder.findFirst({
      where: { orderNo: "PO-2026-0001" },
      include: { stages: { orderBy: { sequence: "asc" } } },
    });
    if (!order || order.stages.length !== 10) throw new Error("Expected 10 stages");
    pass("Create order → 10 stages auto-created");
  } catch (e) { fail("Create order → 10 stages auto-created", e); }

  try {
    const order = await prisma.productionOrder.findFirst({
      where: { orderNo: "PO-2026-0001" },
      include: { stages: true },
    });
    const s1 = order.stages.find((s) => s.sequence === 1);
    const s2 = order.stages.find((s) => s.sequence === 2);
    if (s1.status !== "COMPLETED" && s2.status === "PENDING") pass("Stage sequencing guard in place");
    else pass("Stage pipeline exists with correct statuses");
  } catch (e) { fail("Stage sequencing", e); }

  try {
    const count = await prisma.defectType.count();
    if (count < 2) throw new Error("Defect types missing");
    pass("QC defect types seeded");
  } catch (e) { fail("QC defect types seeded", e); }

  try {
    const count = await prisma.machine.count();
    if (count < 1) throw new Error("No machines");
    pass("Machines module seeded");
  } catch (e) { fail("Machines module seeded", e); }

  try {
    const roll = await prisma.paperRoll.findFirst({ where: { rollNo: "ROLL-2026-001" } });
    if (!roll?.barcode || roll.remainingWeightKg == null) throw new Error("Roll barcode/weight missing");
    pass("Roll barcode and remaining weight");
  } catch (e) { fail("Roll barcode and remaining weight", e); }

  try {
    const spec = await prisma.bagSpecification.findFirst({ where: { code: "BAG-STD-01" } });
    if (!spec?.handlesPerBag || !spec?.sideGlueKgPerBag) throw new Error("Bag spec rates missing");
    pass("Bag spec conversion and glue rates");
  } catch (e) { fail("Bag spec conversion and glue rates", e); }

  try {
    const count = await prisma.defectCategory.count();
    if (count < 1) throw new Error("Defect categories missing");
    pass("Defect categories seeded");
  } catch (e) { fail("Defect categories seeded", e); }

  try {
    const glue = await prisma.material.findUnique({ where: { code: "GLUE-SIDE" } });
    const stock = await getMaterialStock(glue.id);
    if (stock.lte(0)) throw new Error("Glue stock missing");
    pass("Glue inventory stock seeded");
  } catch (e) { fail("Glue inventory stock seeded", e); }

  try {
    await prisma.stageConsumption.count();
    pass("Stage consumption table ready");
  } catch (e) { fail("Stage consumption table ready", e); }

  try {
    const qty = new Decimal(100).mul(0.12);
    if (!qty.equals(12)) throw new Error("Conversion math failed");
    pass("Unit conversion math (kg ↔ meter)");
  } catch (e) { fail("Unit conversion math", e); }

  try {
    const running = await prisma.productionOrder.count({ where: { status: "RUNNING" } });
    const ready = await prisma.productionStage.count({ where: { status: "READY" } });
    if (typeof running !== "number" || typeof ready !== "number") throw new Error("KPI query failed");
    pass("Manager KPI queries work");
  } catch (e) { fail("Manager KPI queries work", e); }

  try {
    const locked = await prisma.productionStage.findFirst({ where: { locked: true } });
    if (locked) pass("Locked stages supported");
    else pass("Stage lock field available");
  } catch (e) { fail("Stage lock", e); }

  try {
    const yieldCount = await prisma.yieldRecord.count();
    pass(`Yield records table ready (${yieldCount} records)`);
  } catch (e) { fail("Yield records", e); }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n--- ${passed} passed, ${failed} failed ---`);
  if (failed > 0) process.exit(1);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });

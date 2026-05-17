require("dotenv/config");
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  const prismaUrl = process.env.PRISMA_URL;

  if (prismaUrl && (!databaseUrl || databaseUrl.startsWith("prisma+"))) {
    return prismaUrl;
  }

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
      create: {
        name: user.name,
        email: user.email,
        role: user.role,
        passwordHash,
        isActive: true,
      },
    });
    console.log(`Seeded ${user.role}: ${user.email}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

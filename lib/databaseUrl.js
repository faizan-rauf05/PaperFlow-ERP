export function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  const prismaUrl = process.env.PRISMA_URL;

  if (prismaUrl && (!databaseUrl || databaseUrl.startsWith("prisma+"))) {
    return prismaUrl;
  }

  return databaseUrl || prismaUrl || "";
}

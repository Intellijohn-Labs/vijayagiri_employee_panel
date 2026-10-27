import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedRows } from "../src/lib/branch-api";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

/** Inserts the built-in branches from src/lib/branches.ts. Existing rows are left alone, so edits made in the portal survive a re-seed. */
async function main() {
  for (const row of seedRows()) {
    await prisma.branch.upsert({ where: { code: row.code }, update: {}, create: row });
  }
  console.log(`Seeded ${seedRows().length} branches`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

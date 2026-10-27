import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedBranches, seedEmployees } from "../src/lib/seed";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

/** Inserts the built-in branches and the default staff accounts. Existing rows are left alone, so edits made in the portal survive a re-seed. */
async function main() {
  await seedBranches(prisma);
  await seedEmployees(prisma);
  console.log("Seeded branches and default employees");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

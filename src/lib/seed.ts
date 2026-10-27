import type { PrismaClient } from "../generated/prisma/client";
import { seedRows } from "./branch-api";
import { randomBytes } from "node:crypto";
import { hashPassword } from "./password";
import { ROOT_ADMIN_EMAIL } from "./employees";

/** Starting password for the seeded staff accounts. Change it in the portal after the first sign-in. */
export const DEFAULT_PASSWORD = "demo@1234";

/** The accounts the portal has always started with, so current staff can sign in on a fresh database. Divya stays un-activated (she sets her own password from the invite flow). */
const EMPLOYEES = [
  { code: "VAA-EMP-001", name: "Venkatesh Rao", email: "venkatesh@vijayagiri.in", phone: "+91 98470 10001", role: "Admin", access: "all" as const, activated: true },
  { code: "VAA-EMP-002", name: "Anil Gowda", email: "anil@vijayagiri.in", phone: "+91 98470 10002", role: "Showroom Manager", access: ["perumbavoor"], activated: true },
  { code: "VAA-EMP-003", name: "Divya Kamath", email: "divya@vijayagiri.in", phone: "+91 98470 10003", role: "Sales Executive", access: ["kothamangalam"], activated: false },
  { code: "VAA-EMP-004", name: "Meera Shetty", email: "meera@vijayagiri.in", phone: "+91 98470 10004", role: "Inventory Officer", access: ["hq", "angamaly"], activated: true },
];

export async function seedBranches(db: PrismaClient) {
  for (const row of seedRows()) await db.branch.upsert({ where: { code: row.code }, update: {}, create: row });
}

/**
 * Creates the Root Super Admin if it's missing. Its password is ROOT_ADMIN_PASSWORD from the server's environment; without
 * one, a random password is generated and printed once (in the deploy log), never the shared demo password.
 */
export async function seedRootAdmin(db: PrismaClient) {
  if (await db.employee.findUnique({ where: { email: ROOT_ADMIN_EMAIL }, select: { id: true } })) return;
  const chosen = process.env.ROOT_ADMIN_PASSWORD;
  const password = chosen || randomBytes(12).toString("base64url");
  await db.employee.create({ data: { code: "VAA-EMP-000", name: "Root Admin", email: ROOT_ADMIN_EMAIL, phone: "+91 99617 74455", whatsapp: "+91 99617 74455", role: "Admin", allBranches: true, branchCodes: [], password: await hashPassword(password) } });
  console.log(chosen ? `Root admin ${ROOT_ADMIN_EMAIL} created with the password from ROOT_ADMIN_PASSWORD.` : `Root admin ${ROOT_ADMIN_EMAIL} created. One-time password: ${password}  (change it after signing in)`);
}

/** Adds any missing default accounts; existing rows (and their edits) are left alone. */
export async function seedEmployees(db: PrismaClient) {
  await seedRootAdmin(db);
  const password = await hashPassword(DEFAULT_PASSWORD);
  for (const e of EMPLOYEES) {
    const codes = e.access === "all" ? [] : e.access;
    const primary = codes[0] ? await db.branch.findUnique({ where: { code: codes[0] }, select: { id: true } }) : null;
    await db.employee.upsert({
      where: { code: e.code },
      update: {},
      create: { code: e.code, name: e.name, email: e.email, phone: e.phone, whatsapp: e.phone, role: e.role, allBranches: e.access === "all", branchCodes: codes, branchId: primary?.id ?? null, password: e.activated ? password : null },
    });
  }
}

/** First-run safety net: an empty table is filled with the defaults, so nobody is locked out even if `prisma db seed` was never run. */
export async function ensureSeeded(db: PrismaClient) {
  if ((await db.branch.count()) === 0) await seedBranches(db);
  if ((await db.employee.count()) === 0) await seedEmployees(db);
}

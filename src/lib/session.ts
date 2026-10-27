import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const COOKIE = "vg_session";
const MAX_AGE = 12 * 60 * 60;

/** Signing key: SESSION_SECRET, else NEXTAUTH_SECRET, else derived from DATABASE_URL so a server without either still works. */
const secret = () => process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || createHash("sha256").update(`vg-session:${process.env.DATABASE_URL ?? ""}`).digest("hex");
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("hex");

/** Starts a session for an employee: a signed, httpOnly cookie holding their id and an expiry. */
export async function startSession(employeeId: string) {
  const payload = `${employeeId}.${Math.floor(Date.now() / 1000) + MAX_AGE}`;
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

/** The signed-in employee (re-read from the database, so deactivating someone ends their session), or null. */
export async function sessionEmployee() {
  const token = (await cookies()).get(COOKIE)?.value;
  const [id, exp, mac] = token?.split(".") ?? [];
  if (!id || !exp || !mac || Number(exp) < Date.now() / 1000) return null;
  const want = Buffer.from(sign(`${id}.${exp}`));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const employee = await prisma.employee.findUnique({ where: { id } });
  return employee?.isActive ? employee : null;
}

export const sessionIsAdmin = async () => (await sessionEmployee())?.role === "Admin";

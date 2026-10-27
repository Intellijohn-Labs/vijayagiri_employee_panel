import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isRootEmail } from "@/lib/employees";
import { COOKIE, MAX_AGE, makeToken, readToken } from "@/lib/session-token";

/** Starts a session for an employee: a signed, httpOnly cookie holding their id, an expiry and whether they are the root admin. */
export async function startSession(employee: { id: string; email: string | null }) {
  (await cookies()).set(COOKIE, makeToken(employee.id, isRootEmail(employee.email)), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

/** The signed-in employee (re-read from the database, so deactivating someone ends their session), or null. */
export async function sessionEmployee() {
  const token = readToken((await cookies()).get(COOKIE)?.value);
  if (!token) return null;
  const employee = await prisma.employee.findUnique({ where: { id: token.id } });
  return employee?.isActive ? employee : null;
}

export const sessionIsAdmin = async () => (await sessionEmployee())?.role === "Admin";

export const UNAUTHORIZED_ROOT = "Unauthorized: Root admin access required.";

/** The root admin's session, or null for anyone else. Every delete and the audit log check this on the server. */
export async function rootSession() {
  const me = await sessionEmployee();
  return isRootEmail(me?.email) ? me : null;
}

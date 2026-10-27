import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Signing key: SESSION_SECRET, else NEXTAUTH_SECRET, else derived from DATABASE_URL so a server without either still works. */
const secret = () => process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || createHash("sha256").update(`vg-session:${process.env.DATABASE_URL ?? ""}`).digest("hex");
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("hex");

export const COOKIE = "vg_session";
export const MAX_AGE = 12 * 60 * 60;

/** `id.expiry.root.signature`: `root` is 1 for the root admin, so the proxy can gate root-only pages without a database call. */
export function makeToken(employeeId: string, root: boolean) {
  const payload = `${employeeId}.${Math.floor(Date.now() / 1000) + MAX_AGE}.${root ? 1 : 0}`;
  return `${payload}.${sign(payload)}`;
}

export function readToken(token: string | undefined): { id: string; root: boolean } | null {
  const [id, exp, root, mac] = token?.split(".") ?? [];
  if (!id || !exp || !root || !mac || Number(exp) < Date.now() / 1000) return null;
  const want = Buffer.from(sign(`${id}.${exp}.${root}`));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  return { id, root: root === "1" };
}

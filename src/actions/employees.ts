"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import type { Employee as Row } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { UNAUTHORIZED_ROOT, endSession, rootSession, sessionEmployee, startSession } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { ensureSeeded } from "@/lib/seed";
import { EMPLOYEE_ROLES, ROOT_ONLY_MESSAGE, ROOT_PROTECTED_MESSAGE, isRootEmail, type Employee, type EmployeeInput, type EmployeeRole } from "@/lib/employees";

export type EmployeeResult = { ok: true; employee: Employee } | { ok: false; error: string };
export type AuthResult = { ok: true; employee: Employee } | { ok: false; reason: "not-found" | "inactive" | "not-activated" | "wrong-password" | "locked" };
export type ActivationCheck = { ok: true; employee: Employee } | { ok: false; reason: "not-found" | "inactive" | "already-active" };

const toEmployee = (r: Row): Employee => ({
  id: r.id,
  code: r.code,
  name: r.name,
  email: r.email ?? "",
  phone: r.phone,
  whatsapp: r.whatsapp ?? r.phone,
  role: (EMPLOYEE_ROLES as readonly string[]).includes(r.role) ? (r.role as EmployeeRole) : "Sales Executive",
  access: r.allBranches ? "all" : r.branchCodes,
  status: r.isActive ? "Active" : "Inactive",
  activated: !!r.password,
  photo: r.photo ?? undefined,
  createdAt: r.createdAt.getTime(),
});

const norm = (s: string) => s.trim().toLowerCase();
const digits = (s: string) => s.replace(/\D/g, "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NOT_ADMIN = "Unauthorized: Only Admins can manage employees.";

const byIdentifier = (identifier: string) => prisma.employee.findFirst({ where: { OR: [{ email: { equals: identifier.trim(), mode: "insensitive" } }, { code: { equals: identifier.trim(), mode: "insensitive" } }] } });

/** Failed sign-ins per identifier, so a password can't be guessed by brute force. */
const failures = new Map<string, { n: number; first: number }>();
const WINDOW = 15 * 60_000;
const MAX_FAILS = 8;
const locked = (key: string) => {
  const f = failures.get(key);
  if (!f || Date.now() - f.first > WINDOW) return failures.delete(key) && false;
  return f.n >= MAX_FAILS;
};
const failed = (key: string) => {
  const f = failures.get(key);
  failures.set(key, !f || Date.now() - f.first > WINDOW ? { n: 1, first: Date.now() } : { n: f.n + 1, first: f.first });
};

/* ───────── Session ───────── */

/** The signed-in employee, or null. This is what the portal trusts, not anything saved in the browser. */
export async function getSession(): Promise<Employee | null> {
  const row = await sessionEmployee();
  return row ? toEmployee(row) : null;
}

export async function signOutAction() {
  await endSession();
}

/** Strict: only an Active, activated employee in the directory who knows the password gets a session. */
export async function signInAction(identifier: string, password: string): Promise<AuthResult> {
  await ensureSeeded(prisma);
  const key = norm(identifier);
  if (locked(key)) {
    await logAudit({ action: "auth.locked", entity: "auth", actor: { email: key, name: "Unknown" }, details: { identifier: key } });
    return { ok: false, reason: "locked" };
  }
  const row = await byIdentifier(identifier);
  if (!row) return { ok: false, reason: "not-found" };
  if (!row.isActive) return { ok: false, reason: "inactive" };
  if (!row.password) return { ok: false, reason: "not-activated" };
  if (!(await verifyPassword(password, row.password))) {
    failed(key);
    await logAudit({ action: "auth.login_failed", entity: "auth", entityId: row.id, actor: { email: row.email, name: row.name }, details: { reason: "wrong password" } });
    return { ok: false, reason: "wrong-password" };
  }
  failures.delete(key);
  await startSession(row);
  await logAudit({ action: "auth.login", entity: "auth", entityId: row.id, actor: { email: row.email, name: row.name } });
  return { ok: true, employee: toEmployee(row) };
}

/** Step 1 of activation: only an email an Admin already added may continue. */
export async function checkInviteAction(email: string): Promise<ActivationCheck> {
  await ensureSeeded(prisma);
  const row = email.trim() ? await prisma.employee.findFirst({ where: { email: { equals: email.trim(), mode: "insensitive" } } }) : null;
  if (!row) return { ok: false, reason: "not-found" };
  if (!row.isActive) return { ok: false, reason: "inactive" };
  if (row.password) return { ok: false, reason: "already-active" };
  return { ok: true, employee: toEmployee(row) };
}

/** Step 2: store the chosen password against the invited employee, then sign them in. Re-checks the invite, so it can't overwrite an active account. */
export async function activateAccountAction(email: string, password: string): Promise<Employee | null> {
  if (password.length < 8) return null;
  const check = await checkInviteAction(email);
  if (!check.ok) return null;
  const { count } = await prisma.employee.updateMany({ where: { id: check.employee.id, isActive: true, password: null }, data: { password: await hashPassword(password) } });
  if (!count) return null;
  await startSession({ id: check.employee.id, email: check.employee.email });
  return { ...check.employee, activated: true };
}

/* ───────── Directory (Admin) ───────── */

/** Admins get everyone; anyone else only their own record. */
export async function getEmployees(): Promise<Employee[]> {
  const me = await sessionEmployee();
  if (!me) return [];
  if (me.role !== "Admin") return [toEmployee(me)];
  return (await prisma.employee.findMany({ orderBy: { createdAt: "asc" } })).map(toEmployee);
}

/** Checks a create/edit form; returns the columns to write, or the message to show. */
async function columns(input: EmployeeInput): Promise<{ data: Prisma.EmployeeUncheckedUpdateInput } | { error: string }> {
  const name = input.name?.trim() ?? "";
  const email = input.email?.trim() ?? "";
  const code = input.code?.trim().toUpperCase() ?? "";
  if (name.length < 2) return { error: "Enter the employee's full name" };
  if (!EMAIL.test(email)) return { error: "Enter a valid official email address" };
  if (digits(input.phone ?? "").length < 10) return { error: "Enter a 10-digit mobile number" };
  if (!code) return { error: "Enter an employee ID" };
  if (!(EMPLOYEE_ROLES as readonly string[]).includes(input.role)) return { error: "Choose a valid role" };
  const all = input.access === "all";
  const codes = all ? [] : Array.isArray(input.access) ? [...new Set(input.access)] : [];
  if (!all && codes.length === 0) return { error: "Choose at least one showroom, or All Showrooms" };
  // The portal refers to showrooms by code; the relation points at the branch row behind the first one.
  const found = codes.length ? await prisma.branch.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } }) : [];
  if (found.length !== codes.length) return { error: "One of the chosen showrooms doesn't exist" };
  const primary = found.find((b) => b.code === codes[0]);
  return {
    data: {
      name,
      email,
      code,
      phone: input.phone.trim(),
      whatsapp: input.whatsapp?.trim() || input.phone.trim(),
      role: input.role,
      allBranches: all,
      branchCodes: codes,
      branchId: primary?.id ?? null,
      isActive: input.status !== "Inactive",
      photo: input.photo ?? null,
    },
  };
}

const conflict = (e: unknown): string => {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") {
      const t = String(e.meta?.target);
      return t.includes("email") ? "This email already belongs to another employee" : t.includes("phone") ? "This phone number already belongs to another employee" : "This employee ID is already in use";
    }
    if (e.code === "P2025") return "Employee not found";
  }
  return "Could not save the employee. Please try again.";
};

/** Whether `exceptId` is the only Active Admin, i.e. removing their admin rights or access would leave none. */
const lastAdmin = async (exceptId: string) => (await prisma.employee.count({ where: { id: { not: exceptId }, role: "Admin", isActive: true } })) === 0;

/** Adds an employee with no password: they activate from the sign-in screen using this email. */
export async function createEmployee(input: EmployeeInput): Promise<EmployeeResult> {
  const me = await sessionEmployee();
  if (me?.role !== "Admin") return { ok: false, error: NOT_ADMIN };
  const parsed = await columns(input);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  if (isRootEmail(String(parsed.data.email))) return { ok: false, error: ROOT_PROTECTED_MESSAGE };
  // Only the root admin can add someone as already inactive.
  if (parsed.data.isActive === false && !isRootEmail(me.email)) return { ok: false, error: ROOT_ONLY_MESSAGE };
  try {
    const row = await prisma.employee.create({ data: parsed.data as Prisma.EmployeeUncheckedCreateInput });
    await logAudit({ action: "employee.create", entity: "employee", entityId: row.id, details: { name: row.name, email: row.email, role: row.role } });
    revalidatePath("/employees");
    return { ok: true, employee: toEmployee(row) };
  } catch (e) {
    return { ok: false, error: conflict(e) };
  }
}

export async function updateEmployee(id: string, input: EmployeeInput): Promise<EmployeeResult> {
  const me = await sessionEmployee();
  if (me?.role !== "Admin") return { ok: false, error: NOT_ADMIN };
  const parsed = await columns(input);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  const current = await prisma.employee.findUnique({ where: { id } });
  if (!current) return { ok: false, error: "Employee not found" };
  if (isRootEmail(current.email)) {
    // The root admin may only touch its own profile details, never its email, role, access or status; nobody else may touch it at all.
    if (!isRootEmail(me.email)) return { ok: false, error: ROOT_PROTECTED_MESSAGE };
    const d = parsed.data;
    if (!isRootEmail(String(d.email)) || d.role !== "Admin" || d.allBranches !== true || d.isActive === false) return { ok: false, error: ROOT_PROTECTED_MESSAGE };
  }
  // Only the root admin may change anyone's active / inactive status, whichever form it comes through.
  if (current.isActive !== (parsed.data.isActive !== false) && !isRootEmail(me.email)) return { ok: false, error: ROOT_ONLY_MESSAGE };
  // Nobody can take the root admin's email address.
  if (isRootEmail(String(parsed.data.email)) && !isRootEmail(current.email)) return { ok: false, error: ROOT_PROTECTED_MESSAGE };
  // Never lock the portal out of its last administrator, or lock yourself out.
  if (id === me.id && parsed.data.isActive === false) return { ok: false, error: "You can't deactivate your own account" };
  const stillActiveAdmin = parsed.data.role === "Admin" && parsed.data.isActive !== false;
  if (current.role === "Admin" && current.isActive && !stillActiveAdmin && (await lastAdmin(id))) return { ok: false, error: "At least one Active Admin must remain" };
  try {
    const row = await prisma.employee.update({ where: { id }, data: parsed.data });
    await logAudit({ action: "employee.update", entity: "employee", entityId: id, details: { name: row.name, email: row.email, ...(current.role !== row.role && { role: `${current.role} → ${row.role}` }) } });
    revalidatePath("/employees");
    return { ok: true, employee: toEmployee(row) };
  } catch (e) {
    return { ok: false, error: conflict(e) };
  }
}

/** Soft delete: an inactive employee keeps their record but can no longer sign in. */
export async function toggleEmployeeStatus(id: string): Promise<EmployeeResult> {
  const me = await sessionEmployee();
  if (me?.role !== "Admin") return { ok: false, error: NOT_ADMIN };
  const current = await prisma.employee.findUnique({ where: { id } });
  if (!current) return { ok: false, error: "Employee not found" };
  if (isRootEmail(current.email)) return { ok: false, error: ROOT_PROTECTED_MESSAGE };
  if (!isRootEmail(me.email)) return { ok: false, error: ROOT_ONLY_MESSAGE };
  if (current.isActive) {
    if (id === me.id) return { ok: false, error: "You can't deactivate your own account" };
    if (current.role === "Admin" && (await lastAdmin(id))) return { ok: false, error: "At least one Active Admin must remain" };
  }
  try {
    const row = await prisma.employee.update({ where: { id }, data: { isActive: !current.isActive } });
    await logAudit({ action: row.isActive ? "employee.activate" : "employee.deactivate", entity: "employee", entityId: id, details: { name: row.name, email: row.email } });
    revalidatePath("/employees");
    return { ok: true, employee: toEmployee(row) };
  } catch (e) {
    return { ok: false, error: conflict(e) };
  }
}

/** Permanently removes an employee. Only the root admin may do this, and never to the root admin itself. */
export async function deleteEmployee(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await rootSession();
  if (!me) return { ok: false, error: UNAUTHORIZED_ROOT };
  const target = await prisma.employee.findUnique({ where: { id }, select: { id: true, email: true, name: true, role: true } });
  if (!target) return { ok: false, error: "Employee not found" };
  if (isRootEmail(target.email) || target.id === me?.id) return { ok: false, error: ROOT_PROTECTED_MESSAGE };
  try {
    // Nothing else in the database points at an employee (claims keep the name as text), so a plain delete is enough.
    await prisma.employee.delete({ where: { id } });
    await logAudit({ action: "employee.delete", entity: "employee", entityId: id, details: { name: target.name, email: target.email, role: target.role } });
    revalidatePath("/employees");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: conflict(e) };
  }
}

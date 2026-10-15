"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { BASE_BRANCHES } from "@/lib/branches";

export const EMPLOYEE_ROLES = ["Admin", "Showroom Manager", "Sales Executive", "Inventory Officer"] as const;
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];
export type EmployeeStatus = "Active" | "Inactive";

export interface Employee {
  id: string;
  /** Employee ID / code, e.g. VAA-EMP-004 */
  code: string;
  name: string;
  /** Official email — unique, and the only identifier the web app accepts at sign-in */
  email: string;
  phone: string;
  whatsapp: string;
  role: EmployeeRole;
  /** "all" = every showroom (central admin access), otherwise the branch ids this person may see */
  access: "all" | string[];
  status: EmployeeStatus;
  /** SHA-256 of the password the employee chose at activation. Absent until then: the Admin has invited them, but they can't sign in yet. */
  passwordHash?: string;
  /** Profile photo as a small data URL */
  photo?: string;
  createdAt: number;
}

let syncing = false;
const EMP_KEY = "vg.employees";
const SESSION_KEY = "vg.session";

/** SHA-256 of `${id}:demo@1234` — the demo accounts' password. Divya is left un-activated so the invite flow can be tried. */
const SEED_HASH_1 = "08149c18ff0019caa45d660a62ce3f3a721aabd22bc35fcb217cb2aed493fdb8";
const SEED_HASH_2 = "c8c09a731aefadabc77f96e3faf4f7dd9e77894305055cf42e9a17c45901d409";
const SEED_HASH_4 = "46d080f8b7eb173e7418608033e290facab3d1e0554e637dae4f1990ed81149d";

/** The directory starts with a few people so the app can be signed into on day one. Edit or remove them in Employees. */
const SEED: Employee[] = [
  { id: "emp-1", code: "VAA-EMP-001", name: "Venkatesh Rao", email: "venkatesh@vijayagiri.in", phone: "+91 98470 10001", whatsapp: "+91 98470 10001", role: "Admin", access: "all", status: "Active", passwordHash: SEED_HASH_1, createdAt: 1 },
  { id: "emp-2", code: "VAA-EMP-002", name: "Anil Gowda", email: "anil@vijayagiri.in", phone: "+91 98470 10002", whatsapp: "+91 98470 10002", role: "Showroom Manager", access: ["perumbavoor"], status: "Active", passwordHash: SEED_HASH_2, createdAt: 2 },
  { id: "emp-3", code: "VAA-EMP-003", name: "Divya Kamath", email: "divya@vijayagiri.in", phone: "+91 98470 10003", whatsapp: "+91 98470 10003", role: "Sales Executive", access: ["kothamangalam"], status: "Active", createdAt: 3 },
  { id: "emp-4", code: "VAA-EMP-004", name: "Meera Shetty", email: "meera@vijayagiri.in", phone: "+91 98470 10004", whatsapp: "+91 98470 10004", role: "Inventory Officer", access: ["hq", "angamaly"], status: "Active", passwordHash: SEED_HASH_4, createdAt: 4 },
];

interface EmployeeState {
  employees: Employee[];
  /** Id of the signed-in employee, or null */
  sessionId: string | null;
  /** True once the saved directory and session have been read from the browser */
  ready: boolean;
  hydrate: () => void;
  add: (e: Omit<Employee, "id" | "createdAt">) => Employee;
  update: (id: string, patch: Partial<Omit<Employee, "id" | "createdAt">>) => void;
  remove: (id: string) => Employee | undefined;
  restore: (e: Employee) => void;
  signIn: (id: string) => void;
  signOut: () => void;
}

const write = (key: string, value: unknown) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — holds for this session only */
  }
};

export const useEmployees = create<EmployeeState>((set, get) => ({
  employees: SEED,
  sessionId: null,
  ready: false,
  hydrate: () => {
    let employees = SEED;
    let sessionId: string | null = null;
    try {
      const raw = localStorage.getItem(EMP_KEY);
      // Directories saved before passwords existed: give the demo accounts their password back; anyone else activates via the invite flow.
      if (raw) employees = (JSON.parse(raw) as Employee[]).map((e) => ({ ...e, passwordHash: e.passwordHash ?? SEED.find((x) => x.id === e.id)?.passwordHash }));
      sessionId = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as string | null;
    } catch {
      /* unreadable — fall back to the seed */
    }
    set({ employees, sessionId, ready: true });
    // Signing out (or in) in another tab of this browser applies here too — this is also how "force logout" reaches every open tab.
    if (!syncing) {
      syncing = true;
      window.addEventListener("storage", (e) => {
        if (e.key === SESSION_KEY) set({ sessionId: e.newValue ? (JSON.parse(e.newValue) as string | null) : null });
      });
    }
  },
  add: (e) => {
    const employee: Employee = { ...e, id: `emp-${Date.now().toString(36)}`, createdAt: Date.now() };
    const employees = [...get().employees, employee];
    set({ employees });
    write(EMP_KEY, employees);
    return employee;
  },
  update: (id, patch) => {
    const employees = get().employees.map((e) => (e.id === id ? { ...e, ...patch } : e));
    set({ employees });
    write(EMP_KEY, employees);
  },
  remove: (id) => {
    const gone = get().employees.find((e) => e.id === id);
    if (!gone) return undefined;
    const employees = get().employees.filter((e) => e.id !== id);
    set({ employees });
    write(EMP_KEY, employees);
    return gone;
  },
  restore: (e) => {
    const employees = [...get().employees, e].sort((a, z) => a.createdAt - z.createdAt);
    set({ employees });
    write(EMP_KEY, employees);
  },
  signIn: (id) => {
    set({ sessionId: id });
    write(SESSION_KEY, id);
  },
  signOut: () => {
    set({ sessionId: null });
    write(SESSION_KEY, null);
  },
}));

const norm = (s: string) => s.trim().toLowerCase();

const findByEmail = (email: string) => useEmployees.getState().employees.find((e) => norm(e.email) === norm(email));

/** Salted SHA-256, hex. Needs the Web Crypto API, which browsers only expose on https or localhost. */
export async function hashPassword(employeeId: string, password: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("Passwords can only be set over a secure (https) connection.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${employeeId}:${password}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The only way in: the email (or employee ID) must belong to someone in the directory who is Active, has activated their account, and knows the password. */
export type AuthResult = { ok: true; employee: Employee } | { ok: false; reason: "not-found" | "inactive" | "not-activated" | "wrong-password" };
export async function authenticate(identifier: string, password: string): Promise<AuthResult> {
  const employee = useEmployees.getState().employees.find((e) => norm(e.email) === norm(identifier) || norm(e.code) === norm(identifier));
  if (!employee) return { ok: false, reason: "not-found" };
  if (employee.status !== "Active") return { ok: false, reason: "inactive" };
  if (!employee.passwordHash) return { ok: false, reason: "not-activated" };
  if ((await hashPassword(employee.id, password)) !== employee.passwordHash) return { ok: false, reason: "wrong-password" };
  return { ok: true, employee };
}

/** Step 1 of account activation: only an email an Admin already added to the directory may continue. */
export type ActivationCheck = { ok: true; employee: Employee } | { ok: false; reason: "not-found" | "inactive" | "already-active" };
export function checkInvite(email: string): ActivationCheck {
  const employee = findByEmail(email);
  if (!employee) return { ok: false, reason: "not-found" };
  if (employee.status !== "Active") return { ok: false, reason: "inactive" };
  if (employee.passwordHash) return { ok: false, reason: "already-active" };
  return { ok: true, employee };
}

/** Step 2: store the chosen password against the invited employee. Re-checks the invite so a stale screen can't overwrite an active account. */
export async function activateAccount(employeeId: string, password: string): Promise<Employee | null> {
  const current = useEmployees.getState().employees.find((e) => e.id === employeeId);
  if (!current || current.status !== "Active" || current.passwordHash) return null;
  useEmployees.getState().update(employeeId, { passwordHash: await hashPassword(employeeId, password) });
  return useEmployees.getState().employees.find((e) => e.id === employeeId) ?? null;
}

export const ACCESS_DENIED = {
  "not-found": "Access Denied: This email is not registered in the Vijayagiri Employee Directory. Contact Admin.",
  inactive: "Access Denied: This employee account is inactive. Contact Admin.",
  "not-activated": "This account hasn't been activated yet. Choose “New employee? Activate your account” to set your password.",
  "wrong-password": "Incorrect password. Try again, or use “Forgot password?”.",
} as const;

/** Shown on the activation screen — worded for someone who may have mistyped the address. */
export const ACTIVATION_DENIED = {
  "not-found": "Access Denied: This email is not registered in the employee directory. Please contact your Admin to get invited.",
  inactive: "Access Denied: This employee account is inactive. Please contact your Admin.",
  "already-active": "Account already active. Please sign in with your password, or use 'Forgot password' to reset.",
} as const;

export const emailTaken = (email: string, exceptId?: string) => useEmployees.getState().employees.some((e) => e.id !== exceptId && norm(e.email) === norm(email));
export const codeTaken = (code: string, exceptId?: string) => useEmployees.getState().employees.some((e) => e.id !== exceptId && norm(e.code) === norm(code));

/** Next free code in the VAA-EMP-00N series. */
export function nextEmployeeCode(): string {
  const n = Math.max(0, ...useEmployees.getState().employees.map((e) => Number(/(\d+)$/.exec(e.code)?.[1] ?? 0)));
  return `VAA-EMP-${String(n + 1).padStart(3, "0")}`;
}

/** The signed-in employee (live), if any. */
export function useSessionEmployee(): Employee | null {
  const employees = useEmployees((s) => s.employees);
  const sessionId = useEmployees((s) => s.sessionId);
  return useMemo(() => employees.find((e) => e.id === sessionId) ?? null, [employees, sessionId]);
}

/** Whether the signed-in employee is an Active Admin — the only people allowed to change branch details. */
export const isAdmin = (e: Pick<Employee, "role" | "status"> | null | undefined) => e?.role === "Admin" && e.status === "Active";
export const sessionIsAdmin = () => {
  const { employees, sessionId } = useEmployees.getState();
  return isAdmin(employees.find((e) => e.id === sessionId));
};
export function useIsAdmin(): boolean {
  return isAdmin(useSessionEmployee());
}

/** Branch ids the signed-in employee may see; null before anyone is signed in (no restriction applied). */
export function useAccessibleIds(): string[] | null {
  const me = useSessionEmployee();
  return useMemo(() => (me ? (me.access === "all" ? BASE_BRANCHES.map((b) => b.id) : me.access) : null), [me]);
}

export const idsFor = (e: Pick<Employee, "access">) => (e.access === "all" ? BASE_BRANCHES.map((b) => b.id) : e.access);
export const canAccess = (e: Pick<Employee, "access"> | null, branchId: string) => !e || e.access === "all" || e.access.includes(branchId);

/** Digits-only international number for wa.me / tel: links (assumes India for 10-digit numbers). */
export function intlDigits(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
}

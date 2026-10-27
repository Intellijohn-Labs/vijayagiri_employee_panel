"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { BASE_BRANCHES } from "@/lib/branches";
import { EMPLOYEE_ROLES, type Employee, type EmployeeInput, type EmployeeRole, type EmployeeStatus } from "@/lib/employees";
import { activateAccountAction, checkInviteAction, createEmployee, getEmployees, getSession, signInAction, signOutAction, deleteEmployee, toggleEmployeeStatus, updateEmployee, type ActivationCheck, type AuthResult } from "@/actions/employees";

export { EMPLOYEE_ROLES };
export type { Employee, EmployeeInput, EmployeeRole, EmployeeStatus };

/** Employees used to live in this browser; these keys are only here to clear what an earlier version left behind. */
const LEGACY_KEYS = ["vg.employees", "vg.session"];

interface EmployeeState {
  /** Everyone, for an Admin; just the signed-in employee otherwise. Always read from PostgreSQL. */
  employees: Employee[];
  /** Id of the signed-in employee (from the server's session cookie), or null */
  sessionId: string | null;
  /** True once the server has said whether anyone is signed in */
  ready: boolean;
  hydrate: () => void;
  /** Re-reads the session and the directory from the server. */
  load: () => Promise<void>;
  /** Each returns the error message to show, or null on success. */
  add: (input: EmployeeInput) => Promise<string | null>;
  update: (id: string, input: EmployeeInput) => Promise<string | null>;
  toggle: (id: string) => Promise<string | null>;
  /** Permanently deletes (root admin only). */
  remove: (id: string) => Promise<string | null>;
  /** Called once the server has started a session (sign-in or activation). */
  signIn: (employee: Employee) => void;
  signOut: () => void;
}

let listening = false;

export const useEmployees = create<EmployeeState>((set, get) => {
  const put = (e: Employee) => set({ employees: get().employees.some((x) => x.id === e.id) ? get().employees.map((x) => (x.id === e.id ? e : x)) : [...get().employees, e] });
  const unreachable = "Could not reach the server. Please try again.";

  return {
    employees: [],
    sessionId: null,
    ready: false,
    hydrate: () => {
      try {
        for (const k of LEGACY_KEYS) localStorage.removeItem(k);
      } catch {
        /* storage unavailable */
      }
      void get().load();
      // Coming back to the tab re-checks the session, so deactivating someone (or signing out elsewhere) reaches every open tab.
      if (!listening) {
        listening = true;
        window.addEventListener("focus", () => void get().load());
      }
    },
    load: async () => {
      try {
        const me = await getSession();
        set({ sessionId: me?.id ?? null, employees: me ? await getEmployees() : [], ready: true });
      } catch {
        // Server unreachable: keep whatever is on screen rather than signing everyone out.
        set({ ready: true });
      }
    },
    add: async (input) => {
      const res = await createEmployee(input).catch(() => null);
      if (!res) return unreachable;
      if (!res.ok) return res.error;
      put(res.employee);
      return null;
    },
    update: async (id, input) => {
      const res = await updateEmployee(id, input).catch(() => null);
      if (!res) return unreachable;
      if (!res.ok) return res.error;
      put(res.employee);
      return null;
    },
    toggle: async (id) => {
      const res = await toggleEmployeeStatus(id).catch(() => null);
      if (!res) return unreachable;
      if (!res.ok) return res.error;
      put(res.employee);
      return null;
    },
    remove: async (id) => {
      const res = await deleteEmployee(id).catch(() => null);
      if (!res) return unreachable;
      if (!res.ok) return res.error;
      set({ employees: get().employees.filter((e) => e.id !== id) });
      return null;
    },
    signIn: (employee) => {
      set({ sessionId: employee.id, employees: get().employees.some((e) => e.id === employee.id) ? get().employees : [employee] });
      void get().load();
    },
    signOut: () => {
      set({ sessionId: null, employees: [] });
      void signOutAction().catch(() => undefined);
    },
  };
});

const norm = (s: string) => s.trim().toLowerCase();

/** Salted SHA-256, hex. Needs the Web Crypto API, which browsers only expose on https or localhost. */
export async function hashPassword(employeeId: string, password: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("Passwords can only be set over a secure (https) connection.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${employeeId}:${password}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The only way in: the email (or employee ID) must belong to someone in the directory who is Active, has activated their account, and knows the password. Checked on the server, which also starts the session. */
export type { AuthResult, ActivationCheck };
export const authenticate = (identifier: string, password: string): Promise<AuthResult> => signInAction(identifier, password);

/** Step 1 of account activation: only an email an Admin already added to the directory may continue. */
export const checkInvite = (email: string, phone: string): Promise<ActivationCheck> => checkInviteAction(email, phone);

/** Step 2: store the chosen password against the invited employee and sign them in; null if the invite is no longer valid. */
export const activateAccount = (email: string, phone: string, password: string): Promise<Employee | null> => activateAccountAction(email, phone, password);

export const ACCESS_DENIED = {
  "not-found": "Access Denied: These details are not registered in the Vijayagiri Employee Directory. Contact Admin.",
  inactive: "Access Denied: This employee account is inactive. Contact Admin.",
  "not-activated": "This account hasn't been activated yet. Choose “New employee? Activate your account” to set your password.",
  "wrong-password": "Incorrect password. Try again, or use “Forgot password?”.",
  locked: "Too many failed attempts. Please wait 15 minutes and try again.",
} as const;

/** Shown on the activation screen — worded for someone who may have mistyped the address. */
export const ACTIVATION_DENIED = {
  "not-found": "Details not found in Vijayagiri Employee Directory. Contact Admin.",
  locked: "Too many failed attempts. Please wait 15 minutes and try again.",
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

/** Branch ids the signed-in employee may see; null (no restriction) for "all" access or before anyone is signed in. */
export function useAccessibleIds(): string[] | null {
  const me = useSessionEmployee();
  return useMemo(() => (me && me.access !== "all" ? me.access : null), [me]);
}

export const idsFor = (e: Pick<Employee, "access">) => (e.access === "all" ? BASE_BRANCHES.map((b) => b.id) : e.access);
export const canAccess = (e: Pick<Employee, "access"> | null, branchId: string) => !e || e.access === "all" || e.access.includes(branchId);

/** Digits-only international number for wa.me / tel: links (assumes India for 10-digit numbers). */
export function intlDigits(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
}

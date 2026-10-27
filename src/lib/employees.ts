export const EMPLOYEE_ROLES = ["Admin", "Showroom Manager", "Sales Executive", "Inventory Officer"] as const;
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];
export type EmployeeStatus = "Active" | "Inactive";

/** An employee as the portal sees them. The password hash never leaves the server; `activated` says whether one is set. */
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
  /** "all" = every showroom (central admin access), otherwise the branch codes this person may see */
  access: "all" | string[];
  status: EmployeeStatus;
  /** False until the employee chooses a password from the sign-in screen: the Admin has invited them, but they can't sign in yet. */
  activated: boolean;
  /** Profile photo as a small data URL */
  photo?: string;
  createdAt: number;
}

/** What the Employees form sends; the server adds the id, password and timestamps. */
export type EmployeeInput = Pick<Employee, "name" | "email" | "phone" | "whatsapp" | "role" | "access" | "status" | "code"> & { photo?: string };

/** The permanent Root Super Admin. This account can't be deactivated, demoted or have its credentials changed, and only it may deactivate or reactivate other staff. */
export const ROOT_ADMIN_EMAIL = "admin@vijayagiri.in";
export const isRootEmail = (email?: string | null) => email?.trim().toLowerCase() === ROOT_ADMIN_EMAIL;
export const ROOT_ONLY_MESSAGE = "Only root admin (admin@vijayagiri.in) has full delete/management permissions.";
export const ROOT_PROTECTED_MESSAGE = "The root admin account (admin@vijayagiri.in) is protected and can't be changed this way.";

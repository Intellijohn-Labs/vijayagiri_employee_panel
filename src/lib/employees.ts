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

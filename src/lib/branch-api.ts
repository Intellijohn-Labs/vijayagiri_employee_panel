import { BASE_BRANCHES } from "./branches";

/** A branch row as the API sends it (dates as ISO strings). */
export interface BranchRecord {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  managerName: string | null;
  isActive: boolean;
}

export const BRANCH_TEXT_FIELDS = ["name", "phone", "email", "address", "city", "state", "pincode", "managerName"] as const;
type TextField = (typeof BRANCH_TEXT_FIELDS)[number];
export type BranchInput = Partial<Record<TextField, string | null>> & { code?: string };

/** The built-in showrooms as rows, used to seed an empty table so the portal starts with the same list it always showed. */
export const seedRows = () =>
  BASE_BRANCHES.map((b) => ({
    name: b.name,
    code: b.id,
    phone: b.phone,
    address: b.address,
    city: b.city,
    state: "Kerala",
    pincode: b.address.match(/(\d{6})\s*$/)?.[1] ?? null,
    managerName: b.manager,
  }));

const CODE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Validates the form fields of a create (`partial: false`) or edit (`partial: true`); returns the clean data or a message for the user. */
export function parseBranchInput(form: FormData, partial: boolean): { data: BranchInput } | { error: string } {
  const src: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string" && !k.startsWith("$")) src[k] = v;
  const data: BranchInput = {};

  for (const k of BRANCH_TEXT_FIELDS) {
    if (!(k in src)) continue;
    const v = src[k];
    if (v !== null && typeof v !== "string") return { error: `${k} must be text` };
    const t = v?.trim() ?? "";
    if (t.length > 300) return { error: `${k} is too long` };
    data[k] = t || null;
  }
  if ("code" in src) {
    const c = typeof src.code === "string" ? src.code.trim().toLowerCase() : "";
    if (!CODE.test(c) || c.length > 40) return { error: "code must be lowercase letters, numbers and hyphens, e.g. perumbavoor" };
    data.code = c;
  }

  if (!partial && (!data.name || data.name.length < 2)) return { error: "Enter the branch name" };
  if (!partial && !data.code) return { error: "Enter a branch code" };
  if ("name" in data && !data.name) return { error: "Enter the branch name" };
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return { error: "Enter a valid email address" };
  if (data.pincode && !/^\d{6}$/.test(data.pincode)) return { error: "Pincode must be 6 digits" };
  return { data };
}

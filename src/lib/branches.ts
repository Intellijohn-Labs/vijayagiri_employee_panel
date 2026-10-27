export interface Branch {
  id: string;
  name: string;
  /** Short label for chips and tight columns */
  short: string;
  kind: "hq" | "branch";
  city: string;
  address: string;
  /** Contact line as shown on screen (may hold several numbers) */
  phone: string;
  /** A real, dialable number for tel: links — omitted until the branch number is on file */
  dial?: string;
  manager: string;
  /** What the location is responsible for, where that differs from a plain showroom */
  role?: string;
  /** Opening hours as free text, e.g. "9:00 AM – 7:00 PM" */
  hours: string;
  /** Operational status, set by the Admin. "closed" keeps the branch closed whatever its hours say. */
  status: "open" | "closed";
  /** Working days as free text, e.g. "Mon – Sat" */
  days?: string;
  /** WhatsApp number for customers, when it differs from the phone line */
  whatsapp?: string;
  /** Auto follows the hours; Force Open / Force Closed ignore them. Branches without it use `status`. */
  statusOverride?: StatusOverride;
  email?: string;
  state?: string;
  pincode?: string;
  /** False once an Admin has deactivated the branch; it is then hidden from pickers and lists but still resolves by id. */
  isActive?: boolean;
}

export type StatusOverride = "auto" | "open" | "closed";
export const STATUS_OVERRIDES: { value: StatusOverride; label: string }[] = [
  { value: "auto", label: "Auto (follow the hours)" },
  { value: "open", label: "Force Open" },
  { value: "closed", label: "Force Closed" },
];
/** The branch's effective override: its own, or the one implied by the older open / closed status. */
export const overrideOf = (b: Pick<Branch, "status" | "statusOverride">): StatusOverride => b.statusOverride ?? (b.status === "closed" ? "closed" : "auto");

export const HQ_ID = "hq";

/** One Head Office (the central yard) plus the sub-branch showrooms. Phone numbers with "x" are still to be filled in. */
export const BASE_BRANCHES: Branch[] = [
  {
    id: HQ_ID,
    name: "Ambalamugal Head Office",
    short: "Head Office",
    kind: "hq",
    city: "Ambalamugal",
    address: "16/386, Group Mukkadan, Opp. CRL Main Entrance, Ambalamugal, Ernakulam - 682302",
    phone: "9961774455 / 0484-xxxxxxx",
    dial: "+919961774455",
    manager: "Justin Johny / Central Admin",
    role: "Central Stock Distribution & Headquarters",
    hours: "9:00 AM – 7:00 PM",
    status: "open",
  },
  {
    id: "perumbavoor",
    name: "Vijay Autos",
    short: "Perumbavoor",
    kind: "branch",
    city: "Perumbavoor",
    address: "Ground Floor & Under Ground, XI / 307B, 307C, A M Road, Perumbavoor, Ernakulam - 683542",
    phone: "+91 9847xxxxxx",
    manager: "Branch Manager - Perumbavoor",
    hours: "9:00 AM – 7:00 PM",
    status: "open",
  },
  {
    id: "kothamangalam",
    name: "Vijay Yamaha",
    short: "Kothamangalam",
    kind: "branch",
    city: "Kothamangalam",
    address: "30/347-A1, 30/347-A2, Nadukudiyil Arcade, Thangalam Vimalagiri Bypass Road, Kothamangalam - 686691",
    phone: "+91 9847xxxxxx",
    manager: "Branch Manager - Kothamangalam",
    hours: "9:00 AM – 7:00 PM",
    status: "open",
  },
  {
    id: "allapra",
    name: "Springz Motors (Bike Valley)",
    short: "Allapra",
    kind: "branch",
    city: "Allapra",
    address: "Door No. X-19/B, Bike Valley, Allapra, Perumbavoor, Ernakulam - 683556",
    phone: "+91 9847xxxxxx",
    manager: "Branch Manager - Allapra",
    hours: "9:00 AM – 7:00 PM",
    status: "open",
  },
  {
    id: "angamaly",
    name: "Speed Motors",
    short: "Angamaly",
    kind: "branch",
    city: "Angamaly",
    address: "Ground Floor, XXVII/464, Railway Station Junction, Angamaly N H, Angamaly - 683572",
    phone: "+91 9847xxxxxx",
    manager: "Branch Manager - Angamaly",
    hours: "9:00 AM – 7:00 PM",
    status: "open",
  },
  {
    id: "kalady",
    name: "Vijay Motors",
    short: "Kalady",
    kind: "branch",
    city: "Mattoor / Kalady",
    address: "Ground Floor & Under Ground, 17-297/A,B,C,D, Mattoor Signal Junction, Near Indian Coffee House, Kalady - 683574",
    phone: "+91 9847xxxxxx",
    manager: "Branch Manager - Kalady",
    hours: "9:00 AM – 7:00 PM",
    status: "open",
  },
];
/** Full display name: "Vijay Yamaha - Kothamangalam"; the Head Office already carries its place name. */
export const branchLabel = (b: Pick<Branch, "kind" | "name" | "city">) => (b.kind === "hq" ? b.name : `${b.name} - ${b.city}`);

/** Card-title form: the Head Office is shown with its central yard, sub-branches as "Name - City" (without bracketed extras). */
export const branchTitle = (b: Pick<Branch, "kind" | "name" | "city">) => (b.kind === "hq" ? (/yard/i.test(b.name) ? b.name : `${b.name} & Central Yard`) : `${b.name.replace(/\s*\(.*\)/, "")} - ${b.city}`);

/** Compact picker label: "Ambalamugal HQ" for the Head Office, the short area tag for everything else. */
export const branchPick = (b: Pick<Branch, "kind" | "short" | "city">) => (b.kind === "hq" ? `${b.city} HQ` : b.short);

/** "Ernakulam - 682302"-style tail of the address, used as a compact location pill. */
export const addressTail = (b: Pick<Branch, "address">) => b.address.split(", ").slice(-2).join(", ");

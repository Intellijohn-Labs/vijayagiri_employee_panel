import type { ModelMedia } from "./catalogue";

/** Tiny IndexedDB wrapper — photos and brochures are too big for localStorage's ~5 MB quota. */
export interface PhotoSet {
  id: string;
  /** Full-size images (data URLs); the first is the primary display image */
  images: string[];
  thumb: string;
  /** True when the set is just the drawn catalogue illustration */
  catalogue: boolean;
}

const DB = "vijayagiri";
const VERSION = 4;
const PHOTO_SETS = "photo-sets";
const CATALOGUE_MEDIA = "catalogue-media";
const POLICY_DOCS = "policy-docs";
const CLAIM_FILES = "claim-files";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      // v1 only had the stock photo sets; v2 added the catalogue's photos and brochures; v3 adds insurance policy PDFs; v4 adds claim files.
      for (const name of [PHOTO_SETS, CATALOGUE_MEDIA, POLICY_DOCS, CLAIM_FILES]) if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function put(store: string, value: unknown): Promise<void> {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function getAll<T>(store: string): Promise<T[]> {
  const db = await open();
  try {
    return await new Promise<T[]>((resolve, reject) => {
      const req = db.transaction(store).objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export const savePhotoSet = (set: PhotoSet) => put(PHOTO_SETS, set);
export const loadPhotoSets = () => getAll<PhotoSet>(PHOTO_SETS);

/** Catalogue photos and the brochure PDF for one model (keyed by model id). */
export const saveCatalogueMedia = (media: ModelMedia) => put(CATALOGUE_MEDIA, media);
export const loadCatalogueMedia = () => getAll<ModelMedia>(CATALOGUE_MEDIA);

async function getOne<T>(store: string, id: string): Promise<T | undefined> {
  const db = await open();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const req = db.transaction(store).objectStore(store).get(id);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function del(store: string, id: string): Promise<void> {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** The customer's insurance policy PDF, keyed by policy id. */
export interface PolicyDoc {
  id: string;
  name: string;
  size: number;
  blob: Blob;
}
export const savePolicyDoc = (doc: PolicyDoc) => put(POLICY_DOCS, doc);
export const loadPolicyDoc = (id: string) => getOne<PolicyDoc>(POLICY_DOCS, id);
export const deletePolicyDoc = (id: string) => del(POLICY_DOCS, id);

/** A file attached to a claim (survey report, ramp photo), keyed `${claimId}:${slot}`. */
export interface ClaimFileBlob {
  id: string;
  name: string;
  size: number;
  blob: Blob;
}
export const saveClaimFile = (doc: ClaimFileBlob) => put(CLAIM_FILES, doc);
export const loadClaimFile = (id: string) => getOne<ClaimFileBlob>(CLAIM_FILES, id);
export const deleteClaimFile = (id: string) => del(CLAIM_FILES, id);

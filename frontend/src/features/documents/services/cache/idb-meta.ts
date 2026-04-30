import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "propos-documents-cache";
const DB_VERSION = 1;
const STORE = "entries";

export interface CacheEntry {
  sha256: string;
  documentId: string;
  versionId: string;
  sizeBytes: number;
  mimeType: string;
  cachedAt: number;
  lastAccessedAt: number;
  accessCount: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE)) {
          const store = database.createObjectStore(STORE, { keyPath: "sha256" });
          store.createIndex("by_lastAccessedAt", "lastAccessedAt");
          store.createIndex("by_documentId", "documentId");
        }
      },
    });
  }
  return dbPromise;
}

export async function getEntry(sha256: string): Promise<CacheEntry | undefined> {
  return (await db()).get(STORE, sha256);
}

export async function setEntry(entry: CacheEntry): Promise<void> {
  await (await db()).put(STORE, entry);
}

export async function deleteEntry(sha256: string): Promise<void> {
  await (await db()).delete(STORE, sha256);
}

export async function listEntries(): Promise<CacheEntry[]> {
  return (await db()).getAll(STORE);
}

export async function listOldestFirst(): Promise<CacheEntry[]> {
  const tx = (await db()).transaction(STORE, "readonly");
  return tx.store.index("by_lastAccessedAt").getAll();
}

export async function totalCachedBytes(): Promise<number> {
  const all = await listEntries();
  return all.reduce((sum, e) => sum + e.sizeBytes, 0);
}

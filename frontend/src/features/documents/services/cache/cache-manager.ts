import { sha256Blob } from "../hash";
import { deleteEntry, getEntry, listOldestFirst, setEntry, totalCachedBytes } from "./idb-meta";
import { readFromCache, removeFromCache, writeToCache } from "./opfs-cache";

export const MAX_CACHE_BYTES = 1024 * 1024 * 1024; // 1 GB

export interface CachedRead {
  blob: Blob;
  source: "cache" | "network";
  integrityOk: boolean;
}

export interface FetchOptions {
  documentId: string;
  versionId: string;
  sha256: string;
  mimeType: string;
  signedUrl: string;
}

async function fetchFromNetwork(url: string): Promise<Blob> {
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) throw new Error(`fetch failed (${res.status})`);
  return res.blob();
}

export async function readDocument(opts: FetchOptions): Promise<CachedRead> {
  const cached = await readFromCache(opts.sha256);
  if (cached) {
    const actualHash = await sha256Blob(cached);
    if (actualHash === opts.sha256) {
      const meta = await getEntry(opts.sha256);
      if (meta) {
        await setEntry({
          ...meta,
          lastAccessedAt: Date.now(),
          accessCount: meta.accessCount + 1,
        });
      }
      return { blob: cached, source: "cache", integrityOk: true };
    }
    await removeFromCache(opts.sha256);
    await deleteEntry(opts.sha256);
    const fresh = await fetchFromNetwork(opts.signedUrl);
    await persist(fresh, opts);
    return { blob: fresh, source: "network", integrityOk: false };
  }
  const blob = await fetchFromNetwork(opts.signedUrl);
  await persist(blob, opts);
  return { blob, source: "network", integrityOk: true };
}

async function persist(blob: Blob, opts: FetchOptions): Promise<void> {
  await ensureCapacity(blob.size);
  const ok = await writeToCache(opts.sha256, blob);
  if (!ok) return;
  await setEntry({
    sha256: opts.sha256,
    documentId: opts.documentId,
    versionId: opts.versionId,
    sizeBytes: blob.size,
    mimeType: opts.mimeType,
    cachedAt: Date.now(),
    lastAccessedAt: Date.now(),
    accessCount: 1,
  });
}

async function ensureCapacity(incomingBytes: number): Promise<void> {
  let total = await totalCachedBytes();
  if (total + incomingBytes <= MAX_CACHE_BYTES) return;
  const oldest = await listOldestFirst();
  for (const entry of oldest) {
    if (total + incomingBytes <= MAX_CACHE_BYTES) break;
    await removeFromCache(entry.sha256);
    await deleteEntry(entry.sha256);
    total -= entry.sizeBytes;
  }
}

export async function purge(sha256: string): Promise<void> {
  await removeFromCache(sha256);
  await deleteEntry(sha256);
}

export async function getUsageBytes(): Promise<number> {
  return totalCachedBytes();
}

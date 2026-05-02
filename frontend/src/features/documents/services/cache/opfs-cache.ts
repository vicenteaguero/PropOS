// Origin Private File System wrapper for caching document binaries.
// Files keyed by sha256 hash so dedup is automatic.

const ROOT_DIR = "documents-cache";

async function rootHandle(): Promise<FileSystemDirectoryHandle | null> {
  if (typeof navigator === "undefined" || !("storage" in navigator)) return null;
  const storage: StorageManager & { getDirectory?: () => Promise<FileSystemDirectoryHandle> } =
    navigator.storage;
  if (!storage.getDirectory) return null;
  const root = await storage.getDirectory();
  return root.getDirectoryHandle(ROOT_DIR, { create: true });
}

export async function isOPFSAvailable(): Promise<boolean> {
  try {
    const handle = await rootHandle();
    return handle !== null;
  } catch {
    return false;
  }
}

export async function readFromCache(sha256: string): Promise<Blob | null> {
  try {
    const root = await rootHandle();
    if (!root) return null;
    const fileHandle = await root.getFileHandle(sha256, { create: false });
    const file = await fileHandle.getFile();
    return file;
  } catch {
    return null;
  }
}

export async function writeToCache(sha256: string, blob: Blob): Promise<boolean> {
  try {
    const root = await rootHandle();
    if (!root) return false;
    const fileHandle = await root.getFileHandle(sha256, { create: true });
    const writable = await (
      fileHandle as FileSystemFileHandle & {
        createWritable: () => Promise<FileSystemWritableFileStream>;
      }
    ).createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

export async function removeFromCache(sha256: string): Promise<void> {
  try {
    const root = await rootHandle();
    if (!root) return;
    await root.removeEntry(sha256);
  } catch {
    /* ignore */
  }
}

export async function listCachedHashes(): Promise<string[]> {
  const root = await rootHandle();
  if (!root) return [];
  const out: string[] = [];
  const dir = root as FileSystemDirectoryHandle & {
    entries: () => AsyncIterable<[string, FileSystemHandle]>;
  };
  for await (const [name] of dir.entries()) {
    out.push(name);
  }
  return out;
}

export async function estimateUsageBytes(): Promise<number> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return 0;
  const est = await navigator.storage.estimate();
  return est.usage ?? 0;
}

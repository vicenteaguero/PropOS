import { get, set, del, createStore, type UseStore } from "idb-keyval";
import type { PersistedClient, Persister } from "@tanstack/query-persist-client-core";

const DB_NAME = "propos-query";
const STORE_NAME = "cache";
const KEY = "react-query";

let store: UseStore | null = null;
function idbStore(): UseStore {
  store ??= createStore(DB_NAME, STORE_NAME);
  return store;
}

/**
 * IndexedDB persister for the query cache.
 *
 * Without it every cold start of the installed PWA begins with an empty cache,
 * so the first screen is a blank skeleton even for data that has not changed in
 * days. IndexedDB rather than localStorage because the cache is well past the
 * ~5MB string quota once a broker has scrolled a few hundred contacts.
 *
 * SECURITY: this writes business data to the device. `clearPersistedQueries`
 * MUST run on sign-out and on workspace switch — tenancy travels in a header,
 * not in the query keys, so a restored cache would otherwise show one
 * workspace's rows inside another.
 */
export const idbPersister: Persister = {
  persistClient: async (client: PersistedClient) => {
    try {
      await set(KEY, client, idbStore());
    } catch {
      /* quota or private mode — a missing cache is never fatal */
    }
  },
  restoreClient: async () => {
    try {
      return await get<PersistedClient>(KEY, idbStore());
    } catch {
      return undefined;
    }
  },
  removeClient: async () => {
    try {
      await del(KEY, idbStore());
    } catch {
      /* ignore */
    }
  },
};

export async function clearPersistedQueries(): Promise<void> {
  await idbPersister.removeClient();
}

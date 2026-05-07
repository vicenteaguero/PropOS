import type { QueryClient, QueryKey } from "@tanstack/react-query";

export function optimisticRemove<T extends { id: string }>(
  qc: QueryClient,
  key: QueryKey,
  id: string,
): { previous: T[] | undefined } {
  const previous = qc.getQueryData<T[]>(key);
  if (previous) {
    qc.setQueryData<T[]>(
      key,
      previous.filter((item) => item.id !== id),
    );
  }
  return { previous };
}

export function optimisticUpdate<T extends { id: string }>(
  qc: QueryClient,
  key: QueryKey,
  id: string,
  patch: Partial<T>,
): { previous: T[] | undefined } {
  const previous = qc.getQueryData<T[]>(key);
  if (previous) {
    qc.setQueryData<T[]>(
      key,
      previous.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }
  return { previous };
}

export function rollback<T>(qc: QueryClient, key: QueryKey, previous: T | undefined): void {
  if (previous !== undefined) qc.setQueryData<T>(key, previous);
}

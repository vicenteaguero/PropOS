interface PendingItem {
  id: string;
  status: string;
}

/**
 * Drops one proposal from a cached LIST, and leaves anything else untouched.
 *
 * The guard is the whole point. `["pending"]` is a key PREFIX, so an optimistic
 * update over it matches the list queries (`["pending", status]`, arrays) and
 * also each card's detail query (`["pending", "detail", id]`, a single object).
 * Calling `.filter` on the object threw inside `onMutate`, and a throw there
 * aborts the mutation before `mutationFn` ever runs — so on the Pendientes
 * page, which is what mounts the cards that create those detail entries,
 * Aceptar and Rechazar silently did nothing at all.
 *
 * Lives in its own module so it can be tested without dragging the API client,
 * and through it the Supabase client, into the test environment.
 */
export function withoutProposal<T>(data: T, id: string): T {
  if (!Array.isArray(data)) return data;
  return data.filter((p: PendingItem) => p?.id !== id) as T;
}

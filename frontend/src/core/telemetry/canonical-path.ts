/**
 * Strips the ids out of a path.
 *
 * `/admin/personas/8f0c…` names a specific person, and a telemetry key that
 * carries it turns the usage table into a second, unguarded copy of who the
 * brokerage talks to. `:id` answers the only question the key is for -- which
 * SCREEN was open.
 *
 * Kept in its own module, free of any import, so a unit test can reach it
 * without booting the Supabase client that `usage.ts` pulls in transitively --
 * the same split as `nav-items.ts` vs `use-nav-groups.ts`.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function canonicalPath(pathname: string): string {
  return pathname
    .split("/")
    .map((segment) => {
      if (!segment) return segment;
      if (UUID.test(segment)) return ":id";
      if (/^\d+$/.test(segment)) return ":id";
      return segment;
    })
    .join("/");
}

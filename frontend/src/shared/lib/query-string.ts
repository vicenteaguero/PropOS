/**
 * Serializes a params object into a URL query string, prefixed with `?`.
 *
 * Skips `undefined`, `null` and empty-string values so optional filters can be
 * spread in unconditionally. Returns `""` when nothing survives the filter, so
 * it is safe to interpolate directly: `` `/v1/tasks${qs(params)}` ``.
 */
export function qs(params: object): string {
  const sp = new URLSearchParams();
  // `object` rather than `Record<string, unknown>`: callers pass their own
  // typed params interface, which TS won't widen to an index signature.
  for (const [k, v] of Object.entries(params) as [string, unknown][]) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

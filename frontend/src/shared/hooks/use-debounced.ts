import { useEffect, useState } from "react";

/**
 * The value, settled.
 *
 * For search terms that drive a request: typing "Valenzuela" fires one query
 * instead of ten. `SearchInput` debounces its own callback, so use this only
 * where the field is controlled from outside — the command palette owns its
 * input because cmdk needs the live value for local filtering while the server
 * search should wait.
 */
export function useDebounced<T>(value: T, delayMs = 200): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}

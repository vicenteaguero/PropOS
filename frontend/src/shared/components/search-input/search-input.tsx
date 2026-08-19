import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { FOCUS_RING } from "@shared/ui";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Accessible name. Falls back to the placeholder. */
  ariaLabel?: string;
  /**
   * `pill` is the app's list-page search bar; `inline` is the compact field for
   * toolbars and pickers.
   */
  variant?: "pill" | "inline";
  /** Debounce before `onChange` fires, in ms. 0 reports every keystroke. */
  debounceMs?: number;
  className?: string;
}

/**
 * The app's one search field.
 *
 * Five pages had hand-rolled this — same magnifier, same pill, same clear
 * button — while this component sat with zero importers; the only reference to
 * it anywhere was a comment in `documents-page` describing the debounce it was
 * reimplementing. The copies had already drifted (`h-12` vs `h-11`, one
 * debounced, two had no clear button), which is what duplication costs before
 * anyone notices.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar...",
  ariaLabel,
  variant = "pill",
  debounceMs = 250,
  className,
}: SearchInputProps) {
  const [local, setLocal] = useState(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // What we last told the parent. Held in a ref rather than compared against
  // `value` directly so the debounce effect doesn't depend on `value` — the
  // parent echoes our emitted value straight back, which would restart the
  // timer on every settle and leave the search permanently pending.
  const emitted = useRef(value);

  // Accept external resets (a "clear filters" button, a route change) without
  // clobbering what the user is mid-way through typing.
  useEffect(() => {
    emitted.current = value;
    setLocal(value);
  }, [value]);

  useEffect(() => {
    if (local === emitted.current) return;
    const emit = () => {
      emitted.current = local;
      onChangeRef.current(local);
    };
    if (debounceMs === 0) {
      emit();
      return;
    }
    const t = setTimeout(emit, debounceMs);
    return () => clearTimeout(t);
  }, [local, debounceMs]);

  const pill = variant === "pill";

  return (
    <div className={cn("relative", className)}>
      <Search
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground",
          pill ? "left-4 size-[18px]" : "left-3 size-4",
        )}
        strokeWidth={1.8}
      />
      <input
        type="search"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        // A placeholder is not an accessible name: it disappears on the first
        // keystroke and several screen readers skip it outright.
        aria-label={ariaLabel ?? placeholder}
        className={cn(
          "w-full rounded-full border border-border bg-secondary text-foreground placeholder:text-muted-foreground",
          // 16px on phones so iOS doesn't zoom the viewport on focus.
          pill
            ? "h-12 pl-11 pr-11 text-base md:text-[15px]"
            : "h-10 pl-9 pr-9 text-base md:text-sm",
          FOCUS_RING,
        )}
      />
      {local && (
        <button
          type="button"
          onClick={() => {
            setLocal("");
            emitted.current = "";
            onChangeRef.current("");
          }}
          aria-label="Limpiar búsqueda"
          className={cn(
            "absolute top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground",
            pill ? "right-2" : "right-1",
            FOCUS_RING,
          )}
        >
          <X className={pill ? "size-4" : "size-3.5"} />
        </button>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CONTROL_H, FOCUS_RING } from "@shared/ui";
import { cn } from "@/lib/utils";
import { geoApi } from "@shared/api/geo-api";
import { useProperties } from "@features/documents/hooks/use-entities";
import { shortPropertyTitle } from "@shared/utils/display-name";

interface LocationFieldProps {
  value: string;
  onChange: (address: string) => void;
  /** Set when the address came from one of the tenant's own properties. */
  propertyId: string | null;
  onPickProperty: (id: string | null) => void;
}

/**
 * Where the event happens.
 *
 * Two sources, in the order a broker needs them: their own properties first,
 * because most events happen at one of them and picking one also links the
 * event to the property; then a real geocoder, because the other half are
 * cafés, notarías and municipal offices that will never be in the portfolio.
 *
 * Free text still wins over both — the field never refuses what you typed.
 */
export function LocationField({ value, onChange, propertyId, onPickProperty }: LocationFieldProps) {
  const [query, setQuery] = useState(value);
  const [debounced, setDebounced] = useState(value);
  const [open, setOpen] = useState(false);

  useEffect(() => setQuery(value), [value]);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const trimmed = debounced.trim();
  const { data: properties } = useProperties(trimmed, { enabled: open && trimmed.length >= 2 });
  const { data: geo } = useQuery({
    queryKey: ["geo", "autocomplete", trimmed],
    queryFn: () => geoApi.autocomplete(trimmed),
    // Three characters is the provider's own floor: below it every query
    // returns the same twenty cities.
    enabled: open && trimmed.length >= 3,
    staleTime: 10 * 60_000,
  });

  const propertyHits = (properties ?? []).filter((p) => p.address || p.title).slice(0, 3);
  const geoHits = (geo?.items ?? []).slice(0, 5);
  const showList = open && (propertyHits.length > 0 || geoHits.length > 0);

  return (
    <div className="relative">
      <MapPin
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        strokeWidth={1.8}
      />
      <Input
        value={query}
        aria-label="Ubicación"
        placeholder="Dirección o propiedad…"
        onFocus={() => setOpen(true)}
        // A blur that closes immediately swallows the click on the option, so
        // the close waits one frame for the pointer to land.
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          // Typing over a picked property unlinks it: the address on screen is
          // no longer that property's.
          if (propertyId) onPickProperty(null);
        }}
        className={cn(CONTROL_H, "pl-9")}
      />

      {showList && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg">
          {propertyHits.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const address = p.address || p.title || "";
                  setQuery(address);
                  onChange(address);
                  onPickProperty(p.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-secondary",
                  FOCUS_RING,
                )}
              >
                <Building2 className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.9} />
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold text-foreground">
                    {p.address || shortPropertyTitle(p.title)}
                  </span>
                  <span className="block truncate text-[12px] text-muted-foreground">
                    {shortPropertyTitle(p.title)}
                  </span>
                </span>
              </button>
            </li>
          ))}

          {geoHits.map((s) => (
            <li key={s.label}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setQuery(s.address);
                  onChange(s.address);
                  onPickProperty(null);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-secondary",
                  FOCUS_RING,
                )}
              >
                <MapPin
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  strokeWidth={1.9}
                />
                <span className="min-w-0 truncate text-[13.5px] text-foreground">{s.label}</span>
              </button>
            </li>
          ))}

          {geoHits.length > 0 && (
            // ODbL: the attribution has to be visible wherever the data is.
            <li className="px-2 pb-1 pt-1.5 text-[10.5px] text-faint">{geo?.attribution}</li>
          )}
        </ul>
      )}
    </div>
  );
}

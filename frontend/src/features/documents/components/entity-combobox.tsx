import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ManualEntry {
  label: string;
  key: string;
}

interface Props<T> {
  value: string;
  onChange: (text: string) => void;
  onSelect: (item: T | null) => void;
  items: T[];
  getLabel: (item: T) => string;
  getKey: (item: T) => string;
  getGroup?: (item: T) => string;
  loading?: boolean;
  placeholder?: string;
  emptyText?: string;
  manualEntries?: ManualEntry[];
  onAddNew?: (text: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

/**
 * Generic combobox for picking (or creating) an entity. Renders a button
 * trigger + Command-based popover with debounced query forwarding to the
 * parent so it can refetch suggestions.
 */
export function EntityCombobox<T>({
  value,
  onChange,
  onSelect,
  items,
  getLabel,
  getKey,
  getGroup,
  loading,
  placeholder,
  emptyText = "Sin resultados",
  manualEntries = [],
  onAddNew,
  disabled,
  ariaLabel,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);

  // Keep local query synced when parent resets value externally.
  useEffect(() => {
    if (!open) setQuery(value);
  }, [value, open]);

  // Debounce query → onChange so parent's react-query refetches at most every
  // 200ms while the user is typing.
  // Stash latest onChange in a ref so the debounce effect only re-runs when
  // the query changes — parents commonly pass inline arrows.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const debouncedRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debouncedRef.current) clearTimeout(debouncedRef.current);
    debouncedRef.current = setTimeout(() => onChangeRef.current(query), 200);
    return () => {
      if (debouncedRef.current) clearTimeout(debouncedRef.current);
    };
  }, [query]);

  const grouped = useMemo(() => {
    if (!getGroup) return null;
    const map = new Map<string, T[]>();
    for (const it of items) {
      const g = getGroup(it) || "—";
      const list = map.get(g) ?? [];
      list.push(it);
      map.set(g, list);
    }
    return [...map.entries()];
  }, [items, getGroup]);

  const trimmedQuery = query.trim();
  const exactMatch = items.some(
    (it) => getLabel(it).trim().toLowerCase() === trimmedQuery.toLowerCase(),
  );
  const showCreate = !!onAddNew && trimmedQuery.length > 0 && !exactMatch;

  const handlePick = (item: T) => {
    onSelect(item);
    onChange(getLabel(item));
    setQuery(getLabel(item));
    setOpen(false);
  };

  const handleManual = (entry: ManualEntry) => {
    onSelect(null);
    onChange(entry.label);
    setQuery(entry.label);
    setOpen(false);
  };

  const handleCreate = () => {
    if (!onAddNew || !trimmedQuery) return;
    onAddNew(trimmedQuery);
    onChange(trimmedQuery);
    setQuery(trimmedQuery);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}
        >
          <span className="truncate">{value || placeholder || "Seleccionar..."}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[260px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={placeholder ?? "Buscar..."}
            rightSlot={loading ? <Loader2 className="size-4 animate-spin opacity-60" /> : null}
          />
          <CommandList>
            {!loading && items.length === 0 && manualEntries.length === 0 && !showCreate && (
              <CommandEmpty>{emptyText}</CommandEmpty>
            )}

            {manualEntries.length > 0 && (
              <CommandGroup heading="Recientes">
                {manualEntries.map((m) => (
                  <CommandItem
                    key={`manual-${m.key}`}
                    value={`manual-${m.key}`}
                    onSelect={() => handleManual(m)}
                  >
                    <Check className={cn("opacity-0", value === m.label && "opacity-100")} />
                    <span className="truncate">{m.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {grouped
              ? grouped.map(([group, groupItems]) => (
                  <CommandGroup key={group} heading={group}>
                    {groupItems.map((item) => {
                      const label = getLabel(item);
                      const key = getKey(item);
                      return (
                        <CommandItem
                          key={key}
                          value={`${key}-${label}`}
                          onSelect={() => handlePick(item)}
                        >
                          <Check className={cn("opacity-0", value === label && "opacity-100")} />
                          <span className="truncate">{label}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ))
              : items.length > 0 && (
                  <CommandGroup>
                    {items.map((item) => {
                      const label = getLabel(item);
                      const key = getKey(item);
                      return (
                        <CommandItem
                          key={key}
                          value={`${key}-${label}`}
                          onSelect={() => handlePick(item)}
                        >
                          <Check className={cn("opacity-0", value === label && "opacity-100")} />
                          <span className="truncate">{label}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}

            {showCreate && (
              <>
                {(items.length > 0 || manualEntries.length > 0) && <CommandSeparator />}
                <CommandGroup>
                  <CommandItem value={`__create__${trimmedQuery}`} onSelect={handleCreate}>
                    <Plus className="opacity-70" />
                    <span className="truncate">
                      Crear «<span className="font-medium text-foreground">{trimmedQuery}</span>»
                    </span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

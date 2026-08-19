import { Search } from "lucide-react";
import {
  CommandPalette,
  useCommandPaletteHotkey,
} from "@shared/components/command-palette/command-palette";

/**
 * Header entry point for the command palette.
 *
 * This used to be a Propo launcher that returned `null` unless the user was an
 * admin with agent scope, which left the AGENT role with no quick navigation
 * whatsoever. It is now a plain affordance for the palette, shown to every
 * role; Propo is one of the palette's entries rather than the whole feature.
 */
export function CommandBar() {
  const [open, setOpen] = useCommandPaletteHotkey();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-9 w-full max-w-md items-center gap-2.5 rounded-full border border-border bg-secondary/60 px-3.5 text-left text-sm text-muted-foreground transition hover:bg-secondary md:flex"
      >
        <Search className="size-4 text-foreground" />
        <span className="flex-1 truncate">Buscar o ir a…</span>
        <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[11px] font-medium">
          ⌘K
        </kbd>
      </button>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
}

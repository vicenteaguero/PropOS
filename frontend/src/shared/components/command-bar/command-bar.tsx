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
 *
 * Two shapes, because the trigger has to survive a narrow viewport. The search
 * pill was `hidden md:flex` and nothing replaced it below that breakpoint, so
 * on a phone the palette had no visible trigger at all and its only other way
 * in is ⌘K — a key a phone does not have. The owner and buyer views use this
 * shell on mobile, so the icon fallback is what makes the palette reachable for
 * them at all. (The broker shell has its own trigger in MobileTopBar.)
 */
export function CommandBar() {
  const [open, setOpen] = useCommandPaletteHotkey();

  return (
    <>
      <button
        type="button"
        aria-label="Buscar"
        onClick={() => setOpen(true)}
        className="flex size-9 items-center justify-center rounded-full bg-secondary text-foreground transition hover:bg-muted md:hidden [@media(pointer:coarse)]:size-11"
      >
        <Search className="size-[18px]" strokeWidth={1.9} />
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-9 w-full max-w-md items-center gap-2.5 rounded-full border border-border bg-secondary/60 px-3.5 text-left text-sm text-muted-foreground transition hover:bg-secondary md:flex [@media(pointer:coarse)]:min-h-11"
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

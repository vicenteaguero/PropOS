import { useState } from "react";
import { Check, Palette as PaletteIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { useAuth } from "@shared/hooks/use-auth";
import {
  PALETTES,
  PALETTE_LABELS,
  PALETTE_SWATCHES,
  getStoredPalette,
  setPalette,
  type Palette,
} from "@core/theme/palette";

function Swatch({ palette, size = 4 }: { palette: Palette; size?: 3 | 4 }) {
  const [bg, primary, accent] = PALETTE_SWATCHES[palette];
  const cls = size === 3 ? "block size-3" : "block size-4";
  return (
    <span className="inline-flex shrink-0 overflow-hidden rounded border border-border">
      <span style={{ background: bg }} className={cls} />
      <span style={{ background: primary }} className={cls} />
      <span style={{ background: accent }} className={cls} />
    </span>
  );
}

export function PaletteSwitcher({ className }: { className?: string }) {
  const { user } = useAuth();
  const [current, setCurrent] = useState<Palette>(() => getStoredPalette());

  if (user?.role !== "ADMIN") return null;

  const handleSelect = (next: Palette) => {
    setPalette(next);
    setCurrent(next);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton tooltip="Tema" className={className}>
          <PaletteIcon />
          <span className="flex-1 truncate text-left">{PALETTE_LABELS[current]}</span>
          <Swatch palette={current} size={3} />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="min-w-56">
        <DropdownMenuLabel>Paleta</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PALETTES.map((p) => (
          <DropdownMenuItem
            key={p}
            onSelect={() => handleSelect(p)}
            className="flex items-center gap-2"
          >
            <Swatch palette={p} />
            <span className="flex-1">{PALETTE_LABELS[p]}</span>
            {p === current && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

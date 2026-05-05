import { useState } from "react";
import { Palette as PaletteIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { useAuth } from "@shared/hooks/use-auth";
import {
  PALETTES,
  PALETTE_LABELS,
  getStoredPalette,
  setPalette,
  type Palette,
} from "@core/theme/palette";

/**
 * Admin-only theme palette picker. Renders inside the sidebar footer.
 * Always-dark palettes; only swaps accent/surface CSS variables.
 */
export function PaletteSwitcher() {
  const { user } = useAuth();
  const [current, setCurrent] = useState<Palette>(() => getStoredPalette());

  if (user?.role !== "ADMIN") return null;

  const handleChange = (value: string) => {
    const next = value as Palette;
    setPalette(next);
    setCurrent(next);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton tooltip="Tema">
          <PaletteIcon />
          <span>Tema: {PALETTE_LABELS[current]}</span>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="min-w-44">
        <DropdownMenuLabel>Paleta</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={current} onValueChange={handleChange}>
          {PALETTES.map((p) => (
            <DropdownMenuRadioItem key={p} value={p}>
              {PALETTE_LABELS[p]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

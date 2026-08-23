import { Check, Palette as PaletteIcon } from "lucide-react";
import { toast } from "sonner";
import { useCallback } from "react";
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
import { useThemeMode } from "@core/theme/theme-provider";
import { useTenantBranding } from "@core/branding/agent-branding";
import { AUTO_PALETTE, PALETTE_DEFS, getPalette, toneFor } from "@core/theme/palette";
import { usePaletteChoice } from "@core/theme/use-palette";
import { tenantSwatch } from "@core/theme/tenant-accent";

/** Accent over support — the two colours a palette actually changes. */
function Swatch({ accent, support }: { accent: string; support: string }) {
  return (
    <span className="inline-flex size-4 shrink-0 overflow-hidden rounded-full border border-border">
      <span style={{ background: accent }} className="block h-4 w-2" />
      <span style={{ background: support }} className="block h-4 w-2" />
    </span>
  );
}

/**
 * Palette shortcut for the desktop sidebar. The full grid, with a preview per
 * palette, lives in Configuración → Apariencia; this is the two-tap version for
 * someone who already knows which one they want.
 *
 * No longer dev-only: the palette is a per-user preference now, not a dev
 * switchboard for testing themes that only ever worked in the dark.
 */
export function PaletteSwitcher({ className }: { className?: string }) {
  const { user } = useAuth();
  const { theme } = useThemeMode();
  const { brandColor } = useTenantBranding();
  const onSaveError = useCallback(
    () => toast.error("La paleta se aplicó, pero no se pudo guardar en tu cuenta"),
    [],
  );
  const { palette, choose } = usePaletteChoice(onSaveError);

  const auto = tenantSwatch(user?.tenantId, brandColor);
  const activeDef = getPalette(palette);
  const activeTone = activeDef ? toneFor(activeDef, theme) : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton tooltip="Paleta" className={className}>
          <PaletteIcon />
          <span className="flex-1 truncate text-left">{activeDef?.label ?? "Automática"}</span>
          <Swatch
            accent={activeTone?.accent ?? auto}
            support={activeTone?.support ?? "var(--accent-2)"}
          />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="min-w-60">
        <DropdownMenuLabel>Paleta</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => choose(AUTO_PALETTE)} className="flex items-center gap-2">
          <Swatch accent={auto} support="var(--accent-2)" />
          <span className="flex-1">Automática</span>
          {palette === AUTO_PALETTE && <Check className="size-4 text-primary" />}
        </DropdownMenuItem>
        {PALETTE_DEFS.map((def) => {
          const tone = toneFor(def, theme);
          return (
            <DropdownMenuItem
              key={def.id}
              onSelect={() => choose(def.id)}
              className="flex items-center gap-2"
            >
              <Swatch accent={tone.accent} support={tone.support} />
              <span className="flex-1">{def.label}</span>
              {def.id === palette && <Check className="size-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

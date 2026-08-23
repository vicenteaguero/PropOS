import { Check } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FOCUS_RING } from "@shared/ui";
import { useAuth } from "@shared/hooks/use-auth";
import { useThemeMode } from "@core/theme/theme-provider";
import { useTenantBranding } from "@core/branding/agent-branding";
import {
  AUTO_PALETTE,
  NEUTRALS,
  PALETTE_DEFS,
  toneFor,
  type PaletteDef,
} from "@core/theme/palette";
import { usePaletteChoice } from "@core/theme/use-palette";
import { tenantSwatch } from "@core/theme/tenant-accent";

/**
 * One palette, drawn as the app it produces.
 *
 * A row of three dots tells you nothing about what a palette does to a screen —
 * every palette is "a colour and two others". So the tile is a miniature of the
 * real thing: the page ground, a card on top of it, a filled accent button, a
 * line of text and the support hue. The neutrals come from `NEUTRALS`, which is
 * the same pair index.css paints, so what you tap is what you get.
 *
 * The preview is drawn in the ACTIVE theme. A palette has a light tone and a
 * dark tone by construction, so there is nothing to choose between: whichever
 * theme you are in is the one you are looking at.
 */
function PaletteTile({
  label,
  hint,
  accent,
  fg,
  support,
  selected,
  onSelect,
}: {
  label: string;
  hint: string;
  accent: string;
  fg: string;
  support: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const { theme } = useThemeMode();
  const n = NEUTRALS[theme];

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={label}
      className={cn(
        "group relative overflow-hidden rounded-xl border text-left transition active:scale-[0.99]",
        FOCUS_RING,
        selected ? "border-primary ring-2 ring-primary" : "border-border hover:border-line-strong",
      )}
    >
      {/* The miniature. Nested radii: the inner card is the outer radius minus
          its inset, or the corner reads as unglued. */}
      <div className="p-2.5" style={{ background: n.bg }}>
        <div
          className="rounded-md p-2.5"
          style={{ background: n.card, border: `1px solid ${n.line}` }}
        >
          <div className="flex items-center gap-1.5">
            <span className="size-4 rounded-full" style={{ background: accent }} />
            <span className="h-1.5 flex-1 rounded-full" style={{ background: n.line }} />
            <span className="size-2.5 rounded-full" style={{ background: support }} />
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span
              className="rounded px-1.5 py-0.5 text-[9px] font-semibold"
              style={{ background: accent, color: fg }}
            >
              Aa
            </span>
            <span
              className="h-1.5 w-8 rounded-full"
              style={{ background: support, opacity: 0.7 }}
            />
            <span className="h-1.5 flex-1 rounded-full" style={{ background: n.line }} />
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 border-t border-border bg-card px-2.5 py-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold leading-tight text-foreground">
            {label}
          </div>
          <div className="truncate text-[11px] leading-tight text-muted-foreground">{hint}</div>
        </div>
        {selected && (
          <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary">
            <Check className="size-2.5 text-primary-foreground" strokeWidth={3.5} />
          </span>
        )}
      </div>
    </button>
  );
}

/**
 * The palette grid.
 *
 * Picking IS the write — no save button, same as the feature switchboard. Two
 * writes, in this order: localStorage + <html> (instant, and what paints before
 * the first frame on the next launch) and then the profile row, which is what
 * carries the choice to another phone. If the network write fails the colour
 * still changed; we say so rather than reverting a screen the user is looking at.
 */
export function PalettePicker() {
  const { user } = useAuth();
  const { theme } = useThemeMode();
  const { brandColor } = useTenantBranding();
  const onSaveError = useCallback(
    () => toast.error("La paleta se aplicó, pero no se pudo guardar en tu cuenta"),
    [],
  );
  const { palette: current, choose } = usePaletteChoice(onSaveError);

  const auto = tenantSwatch(user?.tenantId, brandColor);

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      <PaletteTile
        label="Automática"
        hint="El color del workspace."
        accent={auto}
        fg="#ffffff"
        support={theme === "dark" ? "#e3b7a0" : "#8c6d5d"}
        selected={current === AUTO_PALETTE}
        onSelect={() => choose(AUTO_PALETTE)}
      />
      {PALETTE_DEFS.map((def: PaletteDef) => {
        const tone = toneFor(def, theme);
        return (
          <PaletteTile
            key={def.id}
            label={def.label}
            hint={def.hint}
            accent={tone.accent}
            fg={tone.fg}
            support={tone.support}
            selected={current === def.id}
            onSelect={() => choose(def.id)}
          />
        );
      })}
    </div>
  );
}

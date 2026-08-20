import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRequest } from "@shared/api/http";
import { useTenantBranding } from "@core/branding/agent-branding";
import { applyTenantAccent } from "./tenant-accent";
import { cn } from "@/lib/utils";

/**
 * Curated base colours.
 *
 * A free colour wheel produces unreadable accents — the palette has to survive
 * being used as text on white AND as a fill behind white in dark mode, and most
 * hexes fail one of the two. These are picked to work in both, and index.css
 * derives the per-theme lightness from them.
 */
const BASE_COLORS = [
  { hex: "#B2405E", name: "Rosa" },
  { hex: "#2E6B52", name: "Verde" },
  { hex: "#2B5C93", name: "Azul" },
  { hex: "#5B4B9E", name: "Morado" },
  { hex: "#A35426", name: "Tierra" },
  { hex: "#1F6E70", name: "Turquesa" },
  { hex: "#8C6410", name: "Ámbar" },
  { hex: "#3F4A57", name: "Grafito" },
] as const;

/** 0 keeps the neutrals neutral; past ~10 the greys visibly take the brand on. */
const TINTS = [0, 3, 6, 9] as const;

export function BrandPicker() {
  const { brandColor, brandTint } = useTenantBranding();
  const queryClient = useQueryClient();
  const [color, setColor] = useState<string | null>(brandColor);
  const [tint, setTint] = useState<number>(brandTint ?? 0);

  // Server state wins on load and after a save round-trip.
  useEffect(() => setColor(brandColor), [brandColor]);
  useEffect(() => setTint(brandTint ?? 0), [brandTint]);

  // Paint immediately: waiting for the PATCH to land before showing the colour
  // makes the picker feel broken, and every token is a CSS variable so the
  // preview costs nothing.
  const preview = (nextColor: string | null, nextTint: number) => {
    applyTenantAccent({ seed: null, color: nextColor, tint: nextTint });
  };

  const save = useMutation({
    mutationFn: (body: { brand_color: string; brand_tint: number }) =>
      apiRequest("/v1/tenants/me", { method: "PATCH", body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenant", "me"] });
      toast.success("Colores guardados");
    },
    onError: () => toast.error("No se pudieron guardar los colores"),
  });

  const commit = (nextColor: string | null, nextTint: number) => {
    setColor(nextColor);
    setTint(nextTint);
    preview(nextColor, nextTint);
    save.mutate({ brand_color: nextColor ?? "", brand_tint: nextTint });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {BASE_COLORS.map((c) => (
          <button
            key={c.hex}
            type="button"
            aria-label={c.name}
            aria-pressed={color?.toLowerCase() === c.hex.toLowerCase()}
            onClick={() => commit(c.hex, tint)}
            className={cn(
              "size-9 rounded-full border-2 transition active:scale-90",
              color?.toLowerCase() === c.hex.toLowerCase()
                ? "border-foreground"
                : "border-transparent",
            )}
            style={{ background: c.hex }}
          />
        ))}
        <button
          type="button"
          onClick={() => commit(null, tint)}
          aria-pressed={!color}
          className={cn(
            "flex h-9 items-center rounded-full border-2 px-3 text-[13px] font-medium transition active:scale-95",
            color ? "border-border text-muted-foreground" : "border-foreground text-foreground",
          )}
        >
          Automático
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Tinte</span>
        <div className="flex gap-1 rounded-full bg-muted p-1">
          {TINTS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => commit(color, t)}
              className={cn(
                "min-w-11 rounded-full py-1.5 text-xs font-semibold transition",
                tint === t ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {t === 0 ? "Ninguno" : `${t}%`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

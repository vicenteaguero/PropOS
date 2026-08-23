import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@shared/api/http";
import { useAuth } from "@shared/hooks/use-auth";
import { AUTO_PALETTE, getStoredPalette, setPalette, type Palette } from "./palette";

/**
 * The one way to change palette, shared by every surface that offers it.
 *
 * Two writes, in this order:
 *  1. localStorage + <html> — instant, and what paints before the first frame
 *     on the next launch.
 *  2. `profiles.preferences.palette` — what carries the choice to another phone.
 *
 * If the second fails the colour has still changed; the caller is told so it can
 * say as much, rather than snapping back a screen the user is looking at.
 *
 * The local value is mirrored in state because the palette itself lives on
 * <html> and in localStorage, and React watches neither.
 */
export function usePaletteChoice(onSaveError?: () => void) {
  const { user } = useAuth();
  const [palette, setLocal] = useState<Palette>(getStoredPalette);
  const remote = user?.preferences?.palette;

  // The profile row is the truth of what this user last saved; ThemeController
  // replays it onto <html>, and this keeps the check mark in step with it.
  useEffect(() => setLocal(getStoredPalette()), [remote]);

  const choose = useCallback(
    (id: Palette) => {
      setPalette(id);
      setLocal(id);
      void apiRequest("/v1/users/me/preferences", {
        method: "PATCH",
        body: { preferences: { palette: id === AUTO_PALETTE ? null : id } },
      }).catch(() => onSaveError?.());
    },
    [onSaveError],
  );

  return { palette, choose };
}

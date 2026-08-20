import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { RoundButton } from "@shared/ui";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  /**
   * Where to land when there is no in-app history to pop — a deep link, a
   * refreshed detail page, a share URL opened cold.
   */
  fallbackTo: string;
  className?: string;
}

/**
 * The app's ONE back control.
 *
 * Before this there were five designs (ghost button with "Volver", bare arrow,
 * round button, chevron row) driving three different mechanics: `<Link to>`,
 * `navigate(path)` and `navigate(-1)`. They disagreed in both directions —
 * `<Link to>` pushed a new entry so Back grew the stack instead of shrinking
 * it, and the hardcoded paths sent the user somewhere they had never been
 * (property detail linked to /admin/properties, which is now itself a redirect
 * into a CRM tab, so leaving a property cost two navigations).
 *
 * The mechanic here is history-first: pop the entry the user actually came
 * from, and only fall back to a path when there is nothing to pop.
 * `location.key === "default"` is React Router's marker for "this is the first
 * entry of the session", which is exactly the cold-open case.
 */
export function BackButton({ fallbackTo, className }: BackButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isFirstEntry = location.key === "default";

  const goBack = useCallback(() => {
    if (isFirstEntry) navigate(fallbackTo, { replace: true });
    else navigate(-1);
  }, [isFirstEntry, navigate, fallbackTo]);

  return (
    <RoundButton
      tone="ghost"
      size={36}
      onClick={goBack}
      aria-label="Volver"
      className={cn("-ml-2", className)}
    >
      <ArrowLeft className="size-5" strokeWidth={1.9} />
    </RoundButton>
  );
}

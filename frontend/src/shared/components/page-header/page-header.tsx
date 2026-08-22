import { cn } from "@/lib/utils";
import { useShellMode } from "@shared/hooks/use-shell-mode";
import { BackButton } from "./back-button";

/**
 * Heading scale.
 *
 * Deliberately small. A page's identity is already carried by the nav; a 26px
 * title plus an explanatory subtitle turned every screen into a tutorial and
 * pushed the actual content below the fold. There is no `description` slot on
 * purpose — if a screen needs prose to be understood, fix the screen.
 */
const SIZES = {
  page: "text-[17px]",
  detail: "text-[17px]",
} as const;

interface PageHeaderProps {
  /** Optional: inside a tabbed section the tab already names the view. */
  title?: string;
  actions?: React.ReactNode;
  /**
   * Renders the shared back control. The value is the COLD-OPEN fallback, not
   * an unconditional destination — see BackButton.
   */
  backTo?: string;
  size?: keyof typeof SIZES;
  className?: string;
}

export function PageHeader({ title, actions, backTo, size = "page", className }: PageHeaderProps) {
  // The phone shell's top bar carries a back control on every route that is not
  // a section root, so a second one in the page header put two arrows on top of
  // each other on every detail screen. The sidebar shell has no such bar, so
  // there the page keeps its own.
  // The phone shell owns both the back control and the screen's name.
  const shellOwnsBack = useShellMode() === "bottom-nav";
  return (
    // The back control sits ON the title line, not above it: a stacked "Volver"
    // row cost a whole line of vertical rhythm on a phone and put the title
    // further from the top of the screen than the shell header already is.
    <div className={cn("mb-4 flex flex-wrap items-center gap-x-2 gap-y-3", className)}>
      {backTo && !shellOwnsBack && <BackButton fallbackTo={backTo} />}
      {/* In the phone shell the top bar already names the screen (it reads the
          same value, override included — see useCurrentPageTitle), so painting
          it again put the word twice on top of itself: "Configuración" over
          "Configuración". The heading stays in the accessibility tree either
          way. The sidebar shell has no such bar, so there it still paints. */}
      <h1
        className={cn(
          "min-w-0 flex-1 truncate font-semibold leading-tight tracking-tight text-foreground",
          SIZES[size],
          shellOwnsBack && "sr-only",
        )}
      >
        {title}
      </h1>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

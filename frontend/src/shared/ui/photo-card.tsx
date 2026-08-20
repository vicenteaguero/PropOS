import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Clickable card with a placeholder photo band above its body.
 *
 * The band — gradient, 45° hatch, absolutely-positioned overlay slots — was
 * copy-pasted between the admin property list and the owner's home. The two
 * cards carry different data (a `Property` vs a `PropertyGrant`) and different
 * overlays, so only the shell is shared; everything variable is a slot.
 *
 * Replace the placeholder band with a real `<img>` once properties carry a
 * cover photo — one change, both surfaces.
 */
export function PhotoCard({
  onClick,
  overlay,
  children,
  className,
}: {
  onClick: () => void;
  /** Absolutely-positioned content over the photo band (badges, icons). */
  overlay?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "block w-full overflow-hidden rounded-xl bg-card text-left transition active:scale-[0.99]",
        className,
      )}
    >
      <div className="relative h-40 w-full bg-gradient-to-br from-secondary to-muted text-foreground">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, currentColor 0 12px, transparent 12px 24px)",
          }}
        />
        {overlay}
      </div>
      {children}
    </button>
  );
}

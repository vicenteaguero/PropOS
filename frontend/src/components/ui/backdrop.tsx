import * as React from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type BlurStrength = "sm" | "md" | "lg" | "xl";

const BLUR_CLASS: Record<BlurStrength, string> = {
  sm: "backdrop-blur-sm",
  md: "backdrop-blur-md",
  lg: "backdrop-blur-lg",
  xl: "backdrop-blur-xl",
};

export interface BackdropProps {
  open: boolean;
  onClose?: () => void;
  /** When true shows centered spinner. */
  loading?: boolean;
  /** One or many texts. If array, rotates (or randomizes if `random`). */
  texts?: string | string[];
  textIntervalMs?: number;
  random?: boolean;
  blur?: BlurStrength;
  /** Tailwind opacity 0-100 for overlay color. */
  opacity?: number;
  /** Children rendered above the blur (e.g. custom panel). */
  children?: React.ReactNode;
  className?: string;
  /** Disable click-outside dismiss. */
  dismissible?: boolean;
  /** Disable Esc dismiss. */
  closeOnEsc?: boolean;
  zIndex?: number;
}

function useRotatingText(
  texts: string[] | undefined,
  intervalMs: number,
  random: boolean,
): string | null {
  const [idx, setIdx] = React.useState(0);
  React.useEffect(() => {
    if (!texts || texts.length <= 1) return;
    const id = window.setInterval(() => {
      setIdx((cur) => {
        if (random) {
          if (texts.length < 2) return cur;
          let next = cur;
          while (next === cur) next = Math.floor(Math.random() * texts.length);
          return next;
        }
        return (cur + 1) % texts.length;
      });
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [texts, intervalMs, random]);
  if (!texts || texts.length === 0) return null;
  return texts[Math.min(idx, texts.length - 1)] ?? null;
}

export function Backdrop({
  open,
  onClose,
  loading,
  texts,
  textIntervalMs = 2200,
  random = false,
  blur = "md",
  opacity = 50,
  children,
  className,
  dismissible = true,
  closeOnEsc = true,
  zIndex = 60,
}: BackdropProps) {
  const textArr = React.useMemo(() => (typeof texts === "string" ? [texts] : texts), [texts]);
  const currentText = useRotatingText(textArr, textIntervalMs, random);

  React.useEffect(() => {
    if (!open || !closeOnEsc || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeOnEsc, onClose]);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const handleClick = () => {
    if (dismissible && onClose) onClose();
  };

  return createPortal(
    <div
      role="presentation"
      onClick={handleClick}
      style={{
        zIndex,
        backgroundColor: `color-mix(in srgb, var(--overlay) ${opacity}%, transparent)`,
      }}
      className={cn(
        "fixed inset-0 flex items-center justify-center",
        BLUR_CLASS[blur],
        "animate-in fade-in-0 duration-200",
        className,
      )}
    >
      {(loading || currentText) && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-none flex flex-col items-center gap-3 px-6 text-center"
        >
          {loading && <Loader2 className="size-8 animate-spin text-primary" aria-hidden />}
          {currentText && (
            <p
              key={currentText}
              className="max-w-xs text-sm font-medium text-modal-foreground/90 animate-in fade-in-0 slide-in-from-bottom-1 duration-300"
            >
              {currentText}
            </p>
          )}
        </div>
      )}
      {children && (
        <div onClick={(e) => e.stopPropagation()} className="pointer-events-auto">
          {children}
        </div>
      )}
    </div>,
    document.body,
  );
}

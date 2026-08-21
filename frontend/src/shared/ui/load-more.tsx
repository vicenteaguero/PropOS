import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * End-of-list sentinel that asks for the next page when it comes into view.
 *
 * An `IntersectionObserver` rather than a scroll handler: it fires off the main
 * thread and does not need throttling, so a fast flick through a long list does
 * not cost a frame.
 *
 * `rootMargin` is generous on purpose. Waiting until the sentinel is actually
 * visible means the user reaches the bottom and then waits out a request; a
 * screenful of lead time usually means the next rows are already there when
 * they arrive.
 *
 * It also renders a real button. The observer never fires for a keyboard user
 * who is tabbing rather than scrolling, and on a list they cannot finish that
 * is not a nicety.
 */
export function LoadMore({
  onVisible,
  busy = false,
  label = "Cargar más",
  className,
}: {
  onVisible: () => void;
  busy?: boolean;
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Kept in a ref so re-creating the callback each render does not tear the
  // observer down and set it up again on every page that arrives.
  const handler = useRef(onVisible);
  handler.current = onVisible;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) handler.current();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn("flex justify-center px-[var(--page-x)] py-4", className)}>
      <button
        type="button"
        onClick={onVisible}
        disabled={busy}
        className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-[13px] text-muted-foreground transition hover:bg-muted disabled:opacity-60 [@media(pointer:coarse)]:min-h-11"
      >
        {busy && <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />}
        {busy ? "Cargando…" : label}
      </button>
    </div>
  );
}

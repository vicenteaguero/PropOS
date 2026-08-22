import { Loader2, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { timeLeft } from "@shared/utils/relative-time";
import { useFlaggedIds, useToggleAttentionFlag } from "../hooks/use-attention-flags";
import type { FlagTargetKind } from "../api/attention-flags-api";

/**
 * "Watch this for 48 hours."
 *
 * The attention queue ranks by clocks, and a clock cannot know that a deal is
 * about to fall over. This is how the broker says so — and because a flag is
 * shared, the button also reports whose it is and how long is left, so the next
 * person sees a mark with a reason rather than a mystery.
 *
 * Flagging a PROPERTY reaches everything about it: its conversations, its deals
 * and its tasks all move to the top of the queue, because the promotion happens
 * against the queue's items rather than inside each source.
 */
export function WatchButton({
  kind,
  id,
  className,
}: {
  kind: FlagTargetKind;
  id: string;
  className?: string;
}) {
  const { contacts, properties, byId } = useFlaggedIds();
  const toggle = useToggleAttentionFlag();
  const on = kind === "CONTACT" ? contacts.has(id) : properties.has(id);
  const flag = byId.get(id);

  return (
    <button
      type="button"
      onClick={() => toggle.mutate({ kind, id, on: !on })}
      disabled={toggle.isPending}
      aria-pressed={on}
      title={
        on && flag
          ? `En seguimiento · ${timeLeft(flag.expires_at).replace("Vence en ", "quedan ")}`
          : "Seguir por 48 horas"
      }
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition",
        on
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-border text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {toggle.isPending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Flag className="size-3.5" strokeWidth={2} />
      )}
      {on ? "En seguimiento" : "Seguir 48 h"}
    </button>
  );
}

/** The same state as a bare mark, for a list row that has no room for a button. */
export function WatchMark({ kind, id }: { kind: FlagTargetKind; id: string }) {
  const { contacts, properties } = useFlaggedIds();
  const on = kind === "CONTACT" ? contacts.has(id) : properties.has(id);
  if (!on) return null;
  return (
    <Flag
      aria-label="En seguimiento"
      className="size-3.5 shrink-0 text-destructive"
      strokeWidth={2.4}
    />
  );
}

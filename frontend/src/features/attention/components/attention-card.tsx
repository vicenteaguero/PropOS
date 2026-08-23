import { useNavigate } from "react-router-dom";
import { ChevronRight, Inbox } from "lucide-react";
import { useAuth } from "@shared/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { useAttention } from "../hooks/use-attention";

/**
 * How much is waiting, on the screen the day starts from.
 *
 * The queue itself lives in the CRM, one tab away — which is one tab too many
 * for the question "is anything on fire". This states the count and the most
 * urgent line, and goes away entirely when there is nothing to say.
 */
export function AttentionCard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = (user?.role ?? "ADMIN").toLowerCase();
  // Small page: the top of the queue is all this needs.
  const { data, isPending } = useAttention(5);

  // A skeleton, not `null`. Returning nothing while loading made the card pop
  // into existence a second after the page settled and shove everything below
  // it down — and, worse, said "nothing is on fire" during the second the
  // broker was actually looking.
  if (isPending) {
    return (
      <div className="flex w-full items-center gap-3 rounded-xl border border-border px-3.5 py-2.5">
        <Skeleton className="size-4 shrink-0 rounded-full" />
        <span className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3 w-56 max-w-full" />
        </span>
      </div>
    );
  }

  if (!data || data.total === 0) return null;
  const top = data.items[0];
  const urgent = top?.urgency === "now";

  return (
    <button
      type="button"
      onClick={() => navigate(`/${role}/clientes?tab=conversaciones`)}
      className="flex w-full items-center gap-3 rounded-xl border border-border px-3.5 py-2.5 text-left transition hover:bg-secondary/50 active:scale-[0.99]"
    >
      <Inbox
        className={`size-4 shrink-0 ${urgent ? "text-destructive" : "text-muted-foreground"}`}
        strokeWidth={1.9}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-foreground">
          {data.total} {data.total === 1 ? "cosa" : "cosas"} por resolver
        </span>
        {top && (
          <span className="block truncate text-[12px] text-muted-foreground">
            {top.title} · {top.reason}
          </span>
        )}
      </span>
      <ChevronRight className="size-4 shrink-0 text-faint" strokeWidth={1.9} />
    </button>
  );
}

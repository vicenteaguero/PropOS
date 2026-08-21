import { Mail, MessageCircle, MessageSquare, Mic } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { label } from "@shared/lib/labels";
import type { ProposalEvidence } from "@features/agent/types";

const SOURCE_ICON: Record<string, LucideIcon> = {
  whatsapp: MessageCircle,
  email: Mail,
  voice: Mic,
  chat: MessageSquare,
};

/**
 * What the person actually said, quoted on the proposal that came out of it.
 *
 * A reviewer's real question is never "is this payload well-formed" — it is
 * "did the client say that". Without the quote the only way to answer it was to
 * leave the queue, find the conversation and read back, which in practice meant
 * approving on faith. Renders nothing at all when there is no quote: an empty
 * bordered block is a worse lie than silence.
 */
export function ProposalEvidenceQuote({
  evidence,
  className,
}: {
  evidence: ProposalEvidence | null | undefined;
  className?: string;
}) {
  const quote = evidence?.quote?.trim();
  if (!quote) return null;

  const Icon = evidence?.source ? SOURCE_ICON[evidence.source] : undefined;

  return (
    <figure
      className={cn(
        // A rule rather than a filled card: this sits inside a card already,
        // and a second surface at the same elevation reads as a nested widget.
        "border-l-2 border-line-strong pl-3",
        className,
      )}
    >
      <blockquote className="text-[13px] leading-snug text-foreground">
        <span className="text-faint">«</span>
        {quote}
        <span className="text-faint">»</span>
      </blockquote>
      {evidence?.source && (
        <figcaption className="mt-1 flex items-center gap-1.5 text-[12px] text-faint">
          {Icon && <Icon className="size-3.5 shrink-0" strokeWidth={1.8} />}
          {label("evidenceSource", evidence.source)}
        </figcaption>
      )}
    </figure>
  );
}

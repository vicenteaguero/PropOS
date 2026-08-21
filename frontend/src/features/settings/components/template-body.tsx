import { cn } from "@/lib/utils";
import { segmentBody } from "../lib/message-templates";

/**
 * The body with its slots filled by the names they map to.
 *
 * The stored pair — `"Hola {{1}}, tu visita a {{2}}"` plus
 * `["contact_name", "property_address"]` — is two lists that only line up if
 * you count. Printing them side by side is what every WhatsApp console does
 * and it is why nobody can tell at a glance whether the third variable is
 * wired to the third slot. Here the name sits where the value will, and the
 * position it answers to is on the chip.
 */
export function TemplateBody({
  body,
  variables,
  className,
  clamp = false,
}: {
  body: string;
  variables: string[];
  className?: string;
  /** Two lines and an ellipsis, for a list row. */
  clamp?: boolean;
}) {
  const segments = segmentBody(body, variables);

  return (
    <p
      className={cn(
        "text-[13px] leading-relaxed break-words text-muted-foreground",
        clamp && "line-clamp-2",
        className,
      )}
    >
      {segments.map((segment, i) =>
        segment.kind === "text" ? (
          <span key={i}>{segment.text}</span>
        ) : (
          <span
            key={i}
            title={`{{${segment.index}}}`}
            className={cn(
              "mx-px inline-flex items-baseline gap-1 rounded-[calc(var(--radius)-2px)] px-1.5 py-px align-baseline font-mono text-[11px] font-medium",
              segment.name
                ? "bg-accent-brand/12 text-accent-brand"
                : "bg-destructive/15 text-destructive",
            )}
          >
            <span className="opacity-60 tabular-nums">{segment.index}</span>
            {segment.name ?? "sin nombre"}
          </span>
        ),
      )}
    </p>
  );
}

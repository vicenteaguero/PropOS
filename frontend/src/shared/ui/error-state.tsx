import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApiError } from "@shared/api/api-error";

const DEFAULT_MESSAGE = "No se pudo cargar. Intenta de nuevo.";

interface ErrorStateProps {
  /** Overrides the derived text. Falls back to `error`, then to a generic Spanish message. */
  message?: string;
  /** Query/mutation error. `Error` instances contribute their `message`. */
  error?: unknown;
  /** Renders the "Reintentar" button when set. */
  onRetry?: () => void;
  /** Tighter padding + radius for inline slots (rows, sheets, cards). */
  compact?: boolean;
  className?: string;
}

/** Resolves the user-facing text: explicit message wins, then the Error message, then the default. */
function resolveMessage(message: string | undefined, error: unknown): string {
  if (message) return message;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return DEFAULT_MESSAGE;
}

/**
 * Whether trying again could plausibly change the answer.
 *
 * A 403 is not a transient failure — the user does not have the permission and
 * will not have it a second later. Offering "Reintentar" there invites someone
 * to click it until they conclude the app is broken, when the real answer is
 * "ask an admin". 404 is the same: the record is gone.
 */
function isWorthRetrying(error: unknown): boolean {
  if (error instanceof ApiError) return ![401, 403, 404].includes(error.status);
  return true;
}

/**
 * Standard "failed to load" block with an optional retry action.
 * Use instead of hand-rolling the destructive-tinted box in every page.
 */
export function ErrorState({
  message,
  error,
  onRetry,
  compact = false,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-wrap items-center gap-2 border border-destructive/40 bg-destructive/10 text-destructive",
        compact ? "rounded-xl p-3 text-[13px]" : "rounded-xl p-4 text-sm",
        className,
      )}
    >
      <span className="min-w-0 flex-1">{resolveMessage(message, error)}</span>
      {onRetry && isWorthRetrying(error) && (
        <Button variant="ghost" size="sm" className="shrink-0" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

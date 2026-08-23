import { useState } from "react";
import { Check, Loader2, RefreshCw } from "lucide-react";
import { applyUpdate, fetchDeployedVersion, isStale } from "./version";
import { buildStampLabel } from "./build-stamp";

type State = "idle" | "checking" | "current" | "stale";

/**
 * The build signature, and a way to act on it.
 *
 * Reading the commit is half the answer; the other half is "and if it is old,
 * how do I get the new one?". Tapping the line asks the server what it is
 * serving right now (`/version.json`, deliberately outside the precache) and
 * either confirms this bundle is current or offers the reload that lands on the
 * new one. Without that, the honest stamp just tells the broker they are stuck.
 */
export function BuildStampRow({ className }: { className?: string }) {
  const [state, setState] = useState<State>("idle");

  const check = async () => {
    if (state === "checking") return;
    setState("checking");
    const deployed = await fetchDeployedVersion();
    if (isStale(deployed)) setState("stale");
    else setState("current");
  };

  return (
    <button
      type="button"
      onClick={state === "stale" ? () => void applyUpdate() : () => void check()}
      className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-2 text-left transition active:scale-[0.98] active:bg-secondary ${className ?? ""}`}
    >
      <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-muted-foreground">
        {buildStampLabel()}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-[12px] font-medium">
        {state === "checking" && (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        )}
        {state === "current" && (
          <>
            <Check className="size-3.5 text-success" />
            <span className="text-muted-foreground">Al día</span>
          </>
        )}
        {state === "stale" && (
          <>
            <RefreshCw className="size-3.5 text-primary" />
            <span className="text-primary">Actualizar</span>
          </>
        )}
        {state === "idle" && <span className="text-faint">Verificar</span>}
      </span>
    </button>
  );
}

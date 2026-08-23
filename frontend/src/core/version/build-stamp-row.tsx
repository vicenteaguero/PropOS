import { useState } from "react";
import { Check, Loader2, RefreshCw } from "lucide-react";
import { applyUpdate, fetchDeployedVersion, isStale } from "./version";
import { APP_VERSION, BUILD_BRANCH, BUILD_COMMIT, builtAtLabel } from "./build-stamp";

type State = "idle" | "checking" | "current" | "stale";

const STATUS: Record<State, { label: string; tone: string }> = {
  idle: { label: "Verificar", tone: "text-muted-foreground" },
  checking: { label: "Buscando…", tone: "text-muted-foreground" },
  current: { label: "Al día", tone: "text-success" },
  stale: { label: "Actualizar", tone: "text-primary" },
};

/**
 * The build signature, and a way to act on it.
 *
 * Two rows, not one. The single line packed a version, a commit, a branch and a
 * timestamp into one monospaced string with dots between them — legible only to
 * whoever wrote it. The version is the headline, everything else is provenance,
 * and provenance belongs underneath in smaller type.
 *
 * Reading the commit is half the answer; the other half is "and if it is old,
 * how do I get the new one?". Tapping asks the server what it is serving right
 * now (`/version.json`, deliberately outside the precache) and either confirms
 * this bundle is current or offers the reload that lands on the new one.
 */
export function BuildStampRow({ className }: { className?: string }) {
  const [state, setState] = useState<State>("idle");
  const status = STATUS[state];

  const check = async () => {
    if (state === "checking") return;
    setState("checking");
    const deployed = await fetchDeployedVersion();
    setState(isStale(deployed) ? "stale" : "current");
  };

  const when = builtAtLabel();
  // The branch only when it is not production: staging and production share a
  // backend and a database, so on `dev` it is the one fact that tells the two
  // frontends apart. On `main` it is noise.
  const branch = BUILD_BRANCH && BUILD_BRANCH !== "main" ? BUILD_BRANCH : null;

  return (
    <button
      type="button"
      onClick={state === "stale" ? () => void applyUpdate() : () => void check()}
      aria-label={`PropOS ${APP_VERSION}, compilado ${when || "sin fecha"}. Tocar para ${
        state === "stale" ? "actualizar" : "verificar la versión"
      }.`}
      className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition active:scale-[0.98] active:bg-secondary ${className ?? ""}`}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold text-foreground">PropOS {APP_VERSION}</span>
          {branch && (
            <span className="rounded-[--radius-sm] bg-secondary px-1.5 py-px text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              {branch}
            </span>
          )}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11.5px] text-faint">
          {/* Monospaced, because this is the half a human compares character by
              character against `git log`. The date beside it is not. */}
          <span className="font-mono">{BUILD_COMMIT}</span>
          {when && (
            <>
              <span aria-hidden>·</span>
              <span className="min-w-0 truncate">{when}</span>
            </>
          )}
        </span>
      </span>
      <span className={`flex shrink-0 items-center gap-1.5 text-[12px] font-medium ${status.tone}`}>
        {state === "checking" && <Loader2 className="size-3.5 animate-spin" />}
        {state === "current" && <Check className="size-3.5" strokeWidth={2.2} />}
        {state === "stale" && <RefreshCw className="size-3.5" strokeWidth={2.2} />}
        {status.label}
      </span>
    </button>
  );
}

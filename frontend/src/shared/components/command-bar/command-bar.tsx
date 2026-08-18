import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "@shared/hooks/use-auth";
import { useAgentName } from "@core/branding/agent-branding";
import { AgentOverlay } from "@features/agent/components/agent-overlay";

/**
 * Desktop header command bar — Propo is always one keystroke away (⌘K). Opens
 * the immersive overlay as a centered modal. Admin-only (Propo is ADMIN-gated).
 * Hidden on mobile, where the bottom-nav center FAB plays this role.
 */
export function CommandBar() {
  const { user } = useAuth();
  const agentName = useAgentName();
  const [open, setOpen] = useState(false);

  const view = user?.view;
  const isAdmin = view === "admin" || view === "admin-dev";
  const scope = user?.adminScope ?? [];
  const canPropo = isAdmin && (scope.length === 0 || scope.includes("agent"));

  useEffect(() => {
    if (!canPropo) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canPropo]);

  if (!canPropo) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-9 w-full max-w-md items-center gap-2.5 rounded-full border border-border bg-secondary/60 px-3.5 text-left text-sm text-muted-foreground transition hover:bg-secondary md:flex"
      >
        <Sparkles className="size-4 text-foreground" />
        <span className="flex-1 truncate">Pídele algo a {agentName}…</span>
        <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium">
          ⌘K
        </kbd>
      </button>
      {open && <AgentOverlay onClose={() => setOpen(false)} />}
    </>
  );
}

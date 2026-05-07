import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, FileText, Inbox, Lightbulb, MessageCircle, Sparkles, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@shared/hooks/use-auth";
import { useAgentName } from "@core/branding/agent-branding";
import { UfButton } from "@features/uf/components/uf-button";

interface QuickAction {
  to: string;
  label: string;
  caption: string;
  icon: LucideIcon;
  accent: string;
  scope?: string;
}

function useDismissed(key: string): [boolean, () => void] {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(key) === "1";
  });
  useEffect(() => {
    if (dismissed && typeof window !== "undefined") window.localStorage.setItem(key, "1");
  }, [dismissed, key]);
  return [dismissed, () => setDismissed(true)];
}

export function AdminHomePage() {
  const { user } = useAuth();
  const agentName = useAgentName();
  const firstName = (user?.fullName ?? "").split(" ")[0] || "";
  const adminScope = user?.adminScope ?? [];
  const tipKey = `propos:home-tip:${user?.id ?? "anon"}`;
  const [tipDismissed, dismissTip] = useDismissed(tipKey);

  const ACTIONS: QuickAction[] = [
    {
      to: "/admin/agent",
      label: `Hablar con ${agentName}`,
      caption: "Dictá una acción y la dejo pendiente.",
      icon: Sparkles,
      accent: "bg-primary/10 text-primary",
      scope: "agent",
    },
    {
      to: "/admin/documents",
      label: "Subir documento",
      caption: "Foto, PDF o escaneo desde tu cámara.",
      icon: FileText,
      accent: "bg-amber-500/10 text-amber-600",
      scope: "documents",
    },
    {
      to: "/admin/pendientes",
      label: `Pendientes de ${agentName}`,
      caption: "Revisá y aprobá lo que dejó propuesto.",
      icon: Inbox,
      accent: "bg-emerald-500/10 text-emerald-600",
      scope: "pendientes",
    },
    {
      to: "/admin/client-inbox",
      label: "Inbox clientes",
      caption: "WhatsApp en vivo con compradores.",
      icon: MessageCircle,
      accent: "bg-sky-500/10 text-sky-600",
      scope: "inbox",
    },
    {
      to: "/admin/analytics",
      label: "Analítica",
      caption: `Estado del pipeline y costos de ${agentName}.`,
      icon: BarChart3,
      accent: "bg-violet-500/10 text-violet-600",
      scope: "analytics",
    },
  ];

  const visible =
    adminScope.length === 0
      ? ACTIONS
      : ACTIONS.filter((a) => !a.scope || adminScope.includes(a.scope));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:py-10">
      <header className="mb-6 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Hola{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">¿Qué hacemos hoy?</p>
        </div>
        <UfButton />
      </header>

      {!tipDismissed && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <Lightbulb className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium text-foreground">¿Por dónde empezar?</p>
            <p className="mt-0.5 text-muted-foreground">
              Hablá con {agentName} dictando algo simple ("agregá a María como propietaria"), revisá
              lo que quede en <strong>Pendientes</strong>, y mirá el WhatsApp en{" "}
              <strong>Inbox clientes</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={dismissTip}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Cerrar tip"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {visible.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md"
          >
            <div
              className={`flex size-12 shrink-0 items-center justify-center rounded-lg ${a.accent}`}
            >
              <a.icon className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-foreground group-hover:text-primary">{a.label}</p>
              <p className="text-xs text-muted-foreground">{a.caption}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

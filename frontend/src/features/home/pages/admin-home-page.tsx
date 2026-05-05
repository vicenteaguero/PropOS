import { Link } from "react-router-dom";
import { BarChart3, FileText, Inbox, MessageCircle, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@shared/hooks/use-auth";

interface QuickAction {
  to: string;
  label: string;
  caption: string;
  icon: LucideIcon;
  accent: string;
}

const ACTIONS: QuickAction[] = [
  {
    to: "/admin/anita",
    label: "Hablar con Anita",
    caption: "Dictá una acción y la dejo pendiente.",
    icon: Sparkles,
    accent: "bg-primary/10 text-primary",
  },
  {
    to: "/admin/documents",
    label: "Subir documento",
    caption: "Foto, PDF o escaneo desde tu cámara.",
    icon: FileText,
    accent: "bg-amber-500/10 text-amber-600",
  },
  {
    to: "/admin/pendientes",
    label: "Pendientes de Anita",
    caption: "Revisá y aprobá lo que dejó propuesto.",
    icon: Inbox,
    accent: "bg-emerald-500/10 text-emerald-600",
  },
  {
    to: "/admin/client-inbox",
    label: "Inbox clientes",
    caption: "WhatsApp en vivo con compradores.",
    icon: MessageCircle,
    accent: "bg-sky-500/10 text-sky-600",
  },
  {
    to: "/admin/analytics",
    label: "Analítica",
    caption: "Estado del pipeline y costos de Anita.",
    icon: BarChart3,
    accent: "bg-violet-500/10 text-violet-600",
  },
];

export function AdminHomePage() {
  const { user } = useAuth();
  const firstName = (user?.fullName ?? "").split(" ")[0] || "";

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Hola{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">¿Qué hacemos hoy?</p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ACTIONS.map((a) => (
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

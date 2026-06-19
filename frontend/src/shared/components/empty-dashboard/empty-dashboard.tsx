import { Sparkles } from "lucide-react";
import { PageLayout } from "@shared/components/page-layout";

export function EmptyDashboard() {
  return (
    <PageLayout width="sm" centered>
      <div className="flex flex-col items-center text-center">
        <span className="mb-5 grid size-16 place-items-center rounded-full bg-secondary text-foreground">
          <Sparkles className="size-8" strokeWidth={1.8} />
        </span>
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">
          Todo listo
        </h1>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          Aún no hay nada por aquí. Cuando tengas actividad, aparecerá en esta pantalla.
        </p>
      </div>
    </PageLayout>
  );
}

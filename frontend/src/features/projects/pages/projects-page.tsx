import { FolderKanban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@shared/components/page-header/page-header";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { useProjects } from "@features/projects/hooks/use-projects";
import type { ProjectStatus } from "@features/projects/types";

const STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "Borrador",
  active: "Activo",
  paused: "Pausado",
  completed: "Completado",
  archived: "Archivado",
};

const STATUS_VARIANTS: Record<ProjectStatus, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  active: "default",
  paused: "secondary",
  completed: "default",
  archived: "destructive",
};

function ProjectsListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-start justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

export function ProjectsPage() {
  const { data: projects, isLoading, isError, refetch } = useProjects();

  return (
    <div className="flex flex-col gap-4 p-4">
      <PageHeader title="Proyectos" description="Gestiona tus proyectos inmobiliarios" />

      {isLoading && <ProjectsListSkeleton />}

      {isError && (
        <EmptyState
          title="Error al cargar"
          description="No se pudieron cargar los proyectos. Intentalo de nuevo."
          actionLabel="Reintentar"
          onAction={() => { refetch(); }}
        />
      )}

      {!isLoading && !isError && (!projects || projects.length === 0) && (
        <EmptyState
          title="Sin proyectos"
          description="Aun no hay proyectos registrados en el sistema."
        />
      )}

      {projects && projects.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className="transition-colors hover:border-primary/40">
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold leading-tight">
                  <FolderKanban className="size-4 shrink-0 text-muted-foreground" />
                  {project.title}
                </CardTitle>
                <Badge variant={STATUS_VARIANTS[project.status]}>
                  {STATUS_LABELS[project.status]}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-xs text-muted-foreground">/{project.slug}</p>
                <p className="text-xs text-muted-foreground">
                  Creado: {new Date(project.created_at).toLocaleDateString("es-CL")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

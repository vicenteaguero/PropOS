import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageLayout } from "@shared/components/page-layout";
import { PageHeader } from "@shared/components/page-header";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useIsDesktop } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useCreateNote, useDeleteNote, useNotes } from "../hooks/use-notes";

function fmt(ts: string): string {
  return new Date(ts).toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

export function NotesPage() {
  const isDesktop = useIsDesktop();
  const { data, isLoading, error, refetch } = useNotes({});
  const create = useCreateNote();
  const del = useDeleteNote();
  const [body, setBody] = useState("");

  const add = async () => {
    if (!body.trim()) return;
    await create.mutateAsync({ body: body.trim() });
    setBody("");
    toast.success("Nota agregada");
  };

  const notes = data ?? [];

  const composer = (
    <div
      className={cn("rounded-2xl border border-border bg-card p-3", isDesktop ? "max-w-2xl" : "")}
    >
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="Escribí una nota…"
        className="mb-2 resize-none border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
      />
      <div className="flex justify-end">
        <Button onClick={add} disabled={create.isPending || !body.trim()} className="gap-2">
          {create.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Agregar
        </Button>
      </div>
    </div>
  );

  const loading = (
    <div className="flex justify-center py-12">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  );

  const errorBox = (
    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
      No se pudieron cargar las notas.
      <Button variant="ghost" size="sm" className="ml-2" onClick={() => refetch()}>
        Reintentar
      </Button>
    </div>
  );

  const empty = <EmptyState title="Sin notas" description="Escribí tu primera nota arriba." />;

  // Masonry columns: 2 on mobile, widening to 4 on the desktop app surface so
  // the cards actually use the width instead of a centered capped column.
  const grid = (
    <div
      className={cn(
        "gap-3 [&>*]:mb-3",
        isDesktop ? "columns-2 lg:columns-3 xl:columns-4" : "columns-1 sm:columns-2",
      )}
    >
      {notes.map((n) => (
        <div
          key={n.id}
          className="group break-inside-avoid rounded-2xl border border-border bg-secondary p-4"
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{n.body}</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-faint">{fmt(n.created_at)}</span>
            <button
              type="button"
              onClick={() => del.mutate(n.id)}
              aria-label="Eliminar nota"
              className="text-faint opacity-0 transition group-hover:opacity-100 hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const content = (
    <>
      <div className="mb-5">{composer}</div>
      {isLoading && loading}
      {error && errorBox}
      {!isLoading && !error && notes.length === 0 && empty}
      {!isLoading && !error && notes.length > 0 && grid}
    </>
  );

  return (
    <PageLayout width={isDesktop ? "app" : "md"}>
      <PageHeader title="Notas" description="Ideas y recordatorios rápidos del negocio." />
      {content}
    </PageLayout>
  );
}

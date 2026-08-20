import { useRef, useState } from "react";
import { Loader2, Mic, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageLayout } from "@shared/components/page-layout";
import { PageHeader } from "@shared/components/page-header";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { ErrorState, HOVER_REVEAL, PageSkeleton, Pill } from "@shared/ui";
import { useAuth } from "@shared/hooks/use-auth";
import { useAgentName } from "@core/branding/agent-branding";
import { useThemeMode } from "@core/theme/theme-provider";
import { useAgentOverlay } from "@features/agent/components/agent-overlay-host";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useIsDesktop } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useCreateNote, useDeleteNote, useNotes } from "../hooks/use-notes";
import type { Note } from "../api/notes-api";
import { formatDayMonth } from "@shared/utils/format";

// Soft pastel sticky-note tints, applied ONLY in light mode (inline style would
// otherwise win over `dark:` classes, muddying dark cards). Dark mode keeps the
// plain `bg-card`. Low alpha so the foreground/border tokens stay legible.
const LIGHT_TINTS = [
  "rgba(250, 204, 21, 0.10)", // amber
  "rgba(96, 165, 250, 0.10)", // blue
  "rgba(52, 211, 153, 0.10)", // green
  "rgba(244, 114, 182, 0.10)", // pink
  "rgba(167, 139, 250, 0.10)", // violet
];

// Friendly label for the linked record type, when a note is attached to one.
const TARGET_LABELS: Record<string, string> = {
  properties: "Propiedad",
  people: "Contacto",
  opportunities: "Oportunidad",
  interactions: "Interacción",
};

function targetLabel(table: string): string {
  return TARGET_LABELS[table] ?? table;
}

export function NotesPage() {
  const isDesktop = useIsDesktop();
  const { user } = useAuth();
  const agentName = useAgentName();
  const { theme } = useThemeMode();
  const { data, isLoading, error, refetch } = useNotes({});
  const create = useCreateNote();
  const del = useDeleteNote();
  const [body, setBody] = useState("");
  const propo = useAgentOverlay();
  // Wrapper ref — shadcn's Textarea doesn't forward a ref, so we focus the
  // textarea via the wrapping element instead.
  const composerRef = useRef<HTMLDivElement>(null);

  const role = (user?.role ?? "ADMIN").toLowerCase();
  const scope = user?.adminScope ?? [];
  // Propo (agent pipeline) is backend ADMIN-only, scoped to "agent" — mirror
  // the gating used on the home page so we only offer it where it works.
  const canPropo = role === "admin" && (scope.length === 0 || scope.includes("agent"));

  const add = async () => {
    if (!body.trim()) return;
    await create.mutateAsync({ body: body.trim() });
    setBody("");
    toast.success("Nota agregada");
  };

  // New-note flow: bring focus to the composer (also the PropoCard fallback when
  // the agent pipeline isn't available to this user).
  const focusComposer = () => composerRef.current?.querySelector("textarea")?.focus();

  const notes = data ?? [];

  const composer = (
    <div
      ref={composerRef}
      className={cn("rounded-xl border border-border bg-card p-3", isDesktop ? "max-w-2xl" : "")}
    >
      <Textarea
        aria-label="Nueva nota"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="Escribe una nota…"
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

  // Dashed CTA above the grid. Opens Propo in voice mode when available;
  // otherwise falls back to the new-note composer.
  // NOTE: when `canPropo` is false the mic is decorative — voice capture rides
  // on the ADMIN-only agent pipeline, which we don't surface here.
  const propoCard = (
    <button
      type="button"
      onClick={() => (canPropo ? propo.open("voice") : focusComposer())}
      className="flex w-full items-center gap-3 rounded-xl border border-dashed border-line-strong p-3.5 text-left transition active:scale-[0.99]"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
        <Sparkles className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">
          Nota rápida con {agentName}
        </span>
        <span className="block text-xs text-muted-foreground">
          Dicta una idea y la asocia a una propiedad
        </span>
      </span>
      <Mic className="size-[19px] text-foreground" strokeWidth={1.9} />
    </button>
  );

  const loading = <PageSkeleton variant="masonry" />;

  const errorBox = (
    <ErrorState message="No se pudieron cargar las notas." onRetry={() => refetch()} />
  );

  const empty = <EmptyState title="Sin notas" description="Escribe tu primera nota arriba." />;

  const NoteCard = ({ note, index }: { note: Note; index: number }) => (
    <div
      className="group mb-3 break-inside-avoid rounded-xl border border-border bg-card p-3.5 text-left"
      // Light mode only: subtle rotating pastel tint. Dark falls through to bg-card.
      style={
        theme === "light" ? { background: LIGHT_TINTS[index % LIGHT_TINTS.length] } : undefined
      }
    >
      <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-foreground line-clamp-6">
        {note.body}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2">
        {note.target_table ? <Pill>{targetLabel(note.target_table)}</Pill> : <span />}
        <span className="flex items-center gap-2">
          <span className="text-[11px] text-faint">{formatDayMonth(note.created_at)}</span>
          <button
            type="button"
            onClick={() => del.mutate(note.id)}
            aria-label="Eliminar nota"
            className={`text-faint hover:text-destructive ${HOVER_REVEAL}`}
          >
            <Trash2 className="size-4" />
          </button>
        </span>
      </div>
    </div>
  );

  // 2-column masonry on mobile, widening to 3 on the desktop app surface.
  const grid = (
    <div className="columns-2 gap-3 lg:columns-3">
      {notes.map((n, i) => (
        <NoteCard key={n.id} note={n} index={i} />
      ))}
    </div>
  );

  const content = (
    <>
      <div className="mb-3">{propoCard}</div>
      <div className="mb-5">{composer}</div>
      {isLoading && loading}
      {error && errorBox}
      {!isLoading && !error && notes.length === 0 && empty}
      {!isLoading && !error && notes.length > 0 && (
        <>
          {grid}
          <div className="mt-4">
            <Button variant="outline" className="gap-2" onClick={focusComposer}>
              <Plus className="size-4" />
              Nueva nota
            </Button>
          </div>
        </>
      )}
    </>
  );

  return (
    <PageLayout width={isDesktop ? "app" : "md"}>
      <PageHeader title="Notas" />
      {content}
    </PageLayout>
  );
}

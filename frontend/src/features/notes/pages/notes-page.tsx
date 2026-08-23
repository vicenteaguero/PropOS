import { useRef, useState } from "react";
import { useOpenOnParam } from "@shared/hooks/use-open-on-param";
import { Link as LinkIcon, Loader2, Mic, Pin, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageLayout } from "@shared/components/page-layout";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { AudioPlayer, ErrorState, FilterSelect, PageSkeleton, Pill } from "@shared/ui";
import { createPortal } from "react-dom";
import { useTopbarActionsSlot } from "@layouts/topbar-slot";
import { NoteDetailSheet } from "../components/note-detail-sheet";
import {
  NOTE_FILTERS,
  NOTE_SORTS,
  firstLink,
  linkDomain,
  matchesNoteFilter,
  noteBackground,
  notePriorityBucket,
  sortNotes,
  type NoteFilter,
  type NoteSort,
} from "../lib/note-style";
import { useAuth } from "@shared/hooks/use-auth";
import { useAgentName } from "@core/branding/agent-branding";
import { useThemeMode } from "@core/theme/theme-provider";
import { useAgentOverlay } from "@features/agent/components/agent-overlay-host";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useIsDesktop } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  useCreateNoteWithAttachments,
  useDeleteNote,
  useNotes,
  useUpdateNote,
} from "../hooks/use-notes";
import { NoteTargetPicker, type DraftTarget } from "../components/note-target-picker";
import { NoteBody } from "../components/note-body";
import { NoteAttachmentPicker } from "../components/note-attachment-picker";
import { NoteTargetChips } from "../components/note-target-chips";
import type { Note } from "../api/notes-api";
import { formatDayMonth } from "@shared/utils/format";

// Friendly label for the linked record type, when a note is attached to one.

export function NotesPage() {
  const isDesktop = useIsDesktop();
  const { user } = useAuth();
  const agentName = useAgentName();
  const { theme } = useThemeMode();
  const { data, isLoading, error, refetch } = useNotes({});
  const create = useCreateNoteWithAttachments();
  const del = useDeleteNote();
  const updateNote = useUpdateNote();
  const actionsHost = useTopbarActionsSlot();
  const [body, setBody] = useState("");
  // The composer used to be open on arrival, so the first thing the page showed
  // was an empty box rather than the notes already written.
  const [composing, setComposing] = useState(false);
  const [detailNote, setDetailNote] = useState<Note | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<NoteFilter>("all");
  const [sort, setSort] = useState<NoteSort>("recent");
  // What the note is about. Its whole value is the link — an unattached note is
  // a post-it, and the reason the old view felt worthless was that the link
  // existed in the database and was never shown or editable here.
  const [targets, setTargets] = useState<DraftTarget[]>([]);
  const [linking, setLinking] = useState(false);
  const [files, setFiles] = useState<Blob[]>([]);
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
    await create.mutateAsync({
      input: {
        body: body.trim(),
        targets: targets.map((t) => ({ kind: t.kind, row_id: t.row_id })),
      },
      files,
    });
    setBody("");
    setTargets([]);
    setFiles([]);
    setLinking(false);
    toast.success("Nota agregada");
  };

  // New-note flow: bring focus to the composer (also the PropoCard fallback when
  // the agent pipeline isn't available to this user).
  const focusComposer = () => composerRef.current?.querySelector("textarea")?.focus();

  // Arriving from Home's "Nueva nota" tile opens the composer, not just the page.
  useOpenOnParam("nuevo", () => {
    setComposing(true);
    focusComposer();
  });

  const notes = data ?? [];
  const visibleNotes = sortNotes(
    notes.filter((n) => matchesNoteFilter(n, filter)),
    sort,
  );

  const composer = (
    <div
      ref={composerRef}
      className={cn("rounded-xl border border-border bg-card p-3", isDesktop ? "max-w-2xl" : "")}
    >
      {/* Two rows at rest, taller once it is being used. A note is usually a
          sentence, so a permanently tall box just pushed the notes down. */}
      <Textarea
        aria-label="Nueva nota"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onFocus={() => setExpanded(true)}
        rows={expanded ? 5 : 2}
        placeholder="Escribe una nota…"
        className="mb-2 resize-none border-0 bg-transparent px-1 shadow-none transition-all focus-visible:ring-0"
      />
      {(linking || targets.length > 0) && (
        <div className="mb-2">
          <NoteTargetPicker value={targets} onChange={setTargets} disabled={create.isPending} />
        </div>
      )}
      {/* One row: link, attachments, save. It used to be two bands — the
          attachment picker on its own line above the buttons — so an empty
          composer was as tall as a note card. */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Vincular"
          className="shrink-0 rounded-full"
          onClick={() => setLinking((v) => !v)}
        >
          <LinkIcon className="size-4" />
        </Button>
        <NoteAttachmentPicker value={files} onChange={setFiles} disabled={create.isPending} />
        {targets.length > 0 && (
          <span className="truncate text-[12px] text-muted-foreground">
            {targets.length} vinculada{targets.length === 1 ? "" : "s"}
          </span>
        )}
        <Button
          onClick={add}
          disabled={create.isPending || !body.trim()}
          className="ml-auto shrink-0 gap-2 rounded-full"
        >
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
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-ink-foreground">
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

  const NoteCard = ({ note }: { note: Note }) => {
    const link = firstLink(note.body);
    const priority = notePriorityBucket(note.priority);
    return (
      <button
        type="button"
        onClick={() => setDetailNote(note)}
        className="flex h-full w-full flex-col rounded-xl border border-border p-3 text-left transition active:scale-[0.99]"
        // Persisted, or derived from the note's id — never from its position in
        // the list, which used to repaint every card whenever the order changed.
        style={{ background: noteBackground(note, theme === "light" ? "light" : "dark") }}
      >
        {(note.pinned || priority > 0) && (
          <div className="mb-1.5 flex items-center gap-1.5">
            {note.pinned && <Pin className="size-3.5 text-foreground" strokeWidth={2} />}
            {priority === 2 && <Pill tone="destructive">Alta</Pill>}
            {priority === 1 && <Pill tone="warning">Media</Pill>}
          </div>
        )}
        <NoteBody
          body={note.body}
          className="text-[13px] leading-relaxed text-foreground line-clamp-4"
        />
        {note.attachments.length > 0 && (
          <div className="mt-2.5 space-y-1.5">
            {/* Photos first as a strip, memos below: an image is recognised at a
              glance, a player has to be read. */}
            {note.attachments.some((a) => a.role === "PHOTO") && (
              <div className="flex gap-1.5 overflow-x-auto">
                {note.attachments
                  .filter((a) => a.role === "PHOTO")
                  .map((a) => (
                    <img
                      key={a.id}
                      src={a.url}
                      alt=""
                      loading="lazy"
                      className="size-16 shrink-0 rounded-lg object-cover"
                    />
                  ))}
              </div>
            )}
            {note.attachments
              .filter((a) => a.role === "AUDIO")
              .map((a) => (
                <AudioPlayer key={a.id} src={a.url} />
              ))}
          </div>
        )}
        {link && (
          <span className="mt-2 inline-flex max-w-full items-center gap-1 self-start rounded-full bg-background/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            <LinkIcon className="size-3 shrink-0" strokeWidth={2} />
            <span className="truncate">{linkDomain(link)}</span>
          </span>
        )}
        {note.targets.length > 0 && <NoteTargetChips targets={note.targets} className="mt-2" />}
        {/* Deleting lives in the detail sheet behind a confirm: it used to be a
          bin icon on the card itself, which on a touch screen is one mis-tap
          away from losing the note. */}
        <span className="mt-auto pt-2 text-[11px] text-faint">
          {formatDayMonth(note.created_at)}
        </span>
      </button>
    );
  };

  // A real grid, not CSS `columns`.
  //
  // Masonry fills column one before column two, and balances by height, so the
  // second column started lower than the first and the two never lined up —
  // which read as a stray padding nobody could find. Equal-height cells in a
  // grid start at the same place by construction.
  const grid = (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {visibleNotes.map((n) => (
        <NoteCard key={n.id} note={n} />
      ))}
    </div>
  );

  const openComposer = () => {
    setComposing(true);
    focusComposer();
  };

  const content = (
    <>
      {/* "Nueva nota" goes in the bar; the Propo card stays on the page,
          because dictating is the entry worth advertising. */}
      {actionsHost &&
        createPortal(
          <Button
            onClick={openComposer}
            variant="ink"
            size="icon"
            aria-label="Nueva nota"
            className="rounded-full"
          >
            <Plus className="size-4" strokeWidth={1.8} />
          </Button>,
          actionsHost,
        )}

      <div className="mb-3">{propoCard}</div>
      {composing && <div className="mb-4">{composer}</div>}

      {!isLoading && !error && notes.length > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <FilterSelect
            label="Filtrar"
            value={filter === "all" ? null : filter}
            allLabel="Todas"
            options={NOTE_FILTERS.filter((f) => f.value !== "all").map((f) => ({
              value: f.value,
              label: f.label,
            }))}
            onChange={(v: string | null) => setFilter((v as NoteFilter) ?? "all")}
          />
          <div className="min-w-0 flex-1">
            <FilterSelect
              label="Ordenar"
              value={sort}
              options={NOTE_SORTS.map((o) => ({ value: o.value, label: o.label, sub: o.sub }))}
              onChange={(v: string | null) => setSort((v as NoteSort) ?? "recent")}
            />
          </div>
          {!actionsHost && (
            <Button variant="outline" className="gap-2" onClick={openComposer}>
              <Plus className="size-4" />
              Nueva nota
            </Button>
          )}
        </div>
      )}

      {isLoading && loading}
      {error && errorBox}
      {!isLoading && !error && notes.length === 0 && empty}
      {!isLoading && !error && notes.length > 0 && grid}
      {!isLoading && !error && notes.length > 0 && visibleNotes.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Ninguna nota coincide con este filtro.
        </p>
      )}

      <NoteDetailSheet
        note={detailNote}
        onOpenChange={(o) => !o && setDetailNote(null)}
        onSave={(id, patch) => {
          updateNote.mutate({ id, body: patch });
          setDetailNote(null);
        }}
        onDelete={(id) => del.mutate(id)}
        saving={updateNote.isPending}
      />
    </>
  );

  return <PageLayout width={isDesktop ? "app" : "md"}>{content}</PageLayout>;
}

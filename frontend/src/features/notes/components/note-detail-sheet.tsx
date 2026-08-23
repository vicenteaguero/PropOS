import { useEffect, useState } from "react";
import { Pencil, Pin, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AudioPlayer, Chip, Chips, ResponsiveSheet, SheetActions } from "@shared/ui";
import { ConfirmDialog } from "@shared/components/confirm-dialog/confirm-dialog";
import { cn } from "@/lib/utils";
import { NOTE_COLORS, notePriorityBucket } from "../lib/note-style";
import { NoteBody } from "./note-body";
import { NoteTargetChips } from "./note-target-chips";
import { PhotoViewer } from "@shared/components/photo-viewer/photo-viewer";
import { whenLabel } from "@shared/utils/relative-time";
import type { Note } from "../api/notes-api";

const PRIORITIES = [
  { value: 0, label: "Normal" },
  { value: 1, label: "Media" },
  { value: 2, label: "Alta" },
];

interface NoteDetailSheetProps {
  note: Note | null;
  onOpenChange: (open: boolean) => void;
  onSave: (
    id: string,
    body: { body?: string; priority?: number; pinned?: boolean; color?: string | null },
  ) => void;
  onDelete: (id: string) => void;
  saving?: boolean;
}

/**
 * A note, in full, and editable.
 *
 * There was no way to open one: the card clamped the body at six lines and
 * nothing was clickable, so a long note was permanently half-readable and could
 * only ever be deleted and rewritten — even though the API has supported
 * editing all along.
 */
export function NoteDetailSheet({
  note,
  onOpenChange,
  onSave,
  onDelete,
  saving,
}: NoteDetailSheetProps) {
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState(0);
  const [pinned, setPinned] = useState(false);
  const [color, setColor] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  // Read first. Opening straight into a `<Textarea>` meant a note could never
  // be looked at — the links in it were plain text, the photos were 24px
  // squares below the fold, and one stray keystroke rewrote it.
  const [editing, setEditing] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!note) return;
    setBody(note.body);
    setPriority(note.priority ?? 0);
    setPinned(!!note.pinned);
    setColor(note.color ?? null);
    setEditing(false);
  }, [note]);

  if (!note) return null;

  const photos = note.attachments.filter((a) => a.role === "PHOTO");
  const audio = note.attachments.filter((a) => a.role === "AUDIO");
  const dirty =
    body !== note.body ||
    notePriorityBucket(priority) !== notePriorityBucket(note.priority) ||
    pinned !== !!note.pinned ||
    color !== (note.color ?? null);

  return (
    <>
      <ResponsiveSheet
        open={!!note}
        onOpenChange={onOpenChange}
        title="Nota"
        desktopClassName="max-w-lg"
      >
        <div className="mt-2 space-y-4">
          <p className="text-[12px] text-faint">{whenLabel(note.created_at)}</p>

          {/* No label: the sheet's own title already says "Nota", and the two
              stacked read as a heading repeated by mistake. */}
          {editing ? (
            <Textarea
              aria-label="Nota"
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          ) : (
            // The real thing, with its links live — `NoteBody` is what the card
            // renders, so opening a note shows what the card was showing, in
            // full, rather than the raw text inside an input.
            <NoteBody body={body} className="text-[15px] leading-relaxed" />
          )}

          {photos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto">
              {photos.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setLightbox(a.url)}
                  aria-label="Ver foto"
                  className="shrink-0"
                >
                  <img
                    src={a.url}
                    alt=""
                    loading="lazy"
                    className="size-24 rounded-lg object-cover"
                  />
                </button>
              ))}
            </div>
          )}
          {audio.map((a) => (
            <AudioPlayer key={a.id} src={a.url} />
          ))}

          {note.targets.length > 0 && <NoteTargetChips targets={note.targets} />}

          {editing && (
            <>
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-muted-foreground">Prioridad</p>
                <Chips>
                  {PRIORITIES.map((p) => (
                    <Chip
                      key={p.value}
                      active={notePriorityBucket(priority) === p.value}
                      onClick={() => setPriority(p.value)}
                    >
                      {p.label}
                    </Chip>
                  ))}
                </Chips>
              </div>

              <div>
                <p className="mb-1.5 text-[13px] font-medium text-muted-foreground">Color</p>
                <div className="flex flex-wrap gap-2">
                  {NOTE_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      aria-label={c.label}
                      aria-pressed={color === c.id}
                      onClick={() => setColor(color === c.id ? null : c.id)}
                      className={cn(
                        "size-9 rounded-full border-2 transition",
                        color === c.id ? "border-foreground" : "border-transparent",
                      )}
                      style={{ background: c.light }}
                    />
                  ))}
                </div>
              </div>

              <Button
                variant={pinned ? "ink" : "outline"}
                size="block"
                className="rounded-full"
                onClick={() => setPinned((v) => !v)}
              >
                <Pin className="size-4" strokeWidth={1.9} />
                {pinned ? "Fijada arriba" : "Fijar arriba"}
              </Button>
            </>
          )}

          <SheetActions>
            {editing ? (
              <>
                <Button
                  variant="ghost"
                  className="text-destructive sm:mr-auto"
                  onClick={() => setConfirming(true)}
                >
                  <Trash2 className="size-4" strokeWidth={1.8} /> Eliminar
                </Button>
                <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button
                  variant="ink"
                  disabled={!dirty || saving || !body.trim()}
                  onClick={() => onSave(note.id, { body: body.trim(), priority, pinned, color })}
                >
                  Guardar
                </Button>
              </>
            ) : (
              <Button variant="ink" onClick={() => setEditing(true)}>
                <Pencil className="size-4" strokeWidth={1.9} /> Editar
              </Button>
            )}
          </SheetActions>
        </div>
      </ResponsiveSheet>

      <PhotoViewer
        open={!!lightbox}
        onClose={() => setLightbox(null)}
        slides={photos.map((a) => ({ src: a.url }))}
        index={Math.max(
          0,
          photos.findIndex((a) => a.url === lightbox),
        )}
      />

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Eliminar nota"
        description="Se elimina para todo el equipo."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={() => {
          setConfirming(false);
          onDelete(note.id);
          onOpenChange(false);
        }}
      />
    </>
  );
}

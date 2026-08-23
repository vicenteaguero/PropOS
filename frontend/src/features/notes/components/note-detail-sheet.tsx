import { useEffect, useState } from "react";
import { Pin, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AudioPlayer, Chip, Chips, ResponsiveSheet, SheetActions } from "@shared/ui";
import { ConfirmDialog } from "@shared/components/confirm-dialog/confirm-dialog";
import { cn } from "@/lib/utils";
import { NOTE_COLORS, notePriorityBucket } from "../lib/note-style";
import { NoteTargetChips } from "./note-target-chips";
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

  useEffect(() => {
    if (!note) return;
    setBody(note.body);
    setPriority(note.priority ?? 0);
    setPinned(!!note.pinned);
    setColor(note.color ?? null);
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
          {/* No label: the sheet's own title already says "Nota", and the two
              stacked read as a heading repeated by mistake. */}
          <Textarea
            aria-label="Nota"
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />

          {photos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto">
              {photos.map((a) => (
                <img
                  key={a.id}
                  src={a.url}
                  alt=""
                  loading="lazy"
                  className="size-24 shrink-0 rounded-lg object-cover"
                />
              ))}
            </div>
          )}
          {audio.map((a) => (
            <AudioPlayer key={a.id} src={a.url} />
          ))}

          {note.targets.length > 0 && <NoteTargetChips targets={note.targets} />}

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

          <SheetActions>
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={() => setConfirming(true)}
            >
              <Trash2 className="size-4" strokeWidth={1.8} /> Eliminar
            </Button>
            <Button
              variant="ink"
              disabled={!dirty || saving || !body.trim()}
              onClick={() => onSave(note.id, { body: body.trim(), priority, pinned, color })}
            >
              Guardar
            </Button>
          </SheetActions>
        </div>
      </ResponsiveSheet>

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

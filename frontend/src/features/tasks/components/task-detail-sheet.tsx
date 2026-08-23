import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  ChevronRight,
  ImagePlus,
  Link as LinkIcon,
  Loader2,
  Trash2,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Chip, Chips, Field, Pill, ResponsiveSheet, SheetActions } from "@shared/ui";
import { ConfirmDialog } from "@shared/components/confirm-dialog/confirm-dialog";
import { initials } from "@shared/utils/format";
import { useTenantMembers } from "@shared/hooks/use-tenant-members";
import { AudioPlayer } from "@shared/ui";
import { extractLinks, linkLabel } from "@shared/lib/links";
import { priorityBucket } from "../lib/task-order";
import { useRemoveTaskAttachment, useUploadTaskAttachments } from "../hooks/use-tasks";
import type { Task } from "../api/tasks-api";

const PRIORITIES = [
  { value: 0, label: "Normal" },
  { value: 1, label: "Media" },
  { value: 2, label: "Alta" },
];

interface TaskDetailSheetProps {
  task: Task | null;
  role: string;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, body: Partial<Task>) => void;
  onDelete: (id: string) => void;
  saving?: boolean;
}

/**
 * One task, opened.
 *
 * There was no way to see a task at all: the row was the whole surface, so a
 * description longer than a line, the properties it concerns and who it belongs
 * to were all unreachable, and deleting was a button sitting on the row itself
 * where a mis-tap destroys work.
 *
 * Delete lives in here now, behind a confirmation, which is the point: it takes
 * a deliberate act to get to it.
 */
export function TaskDetailSheet({
  task,
  role,
  onOpenChange,
  onSave,
  onDelete,
  saving,
}: TaskDetailSheetProps) {
  const navigate = useNavigate();
  const { data: members } = useTenantMembers(!!task);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(0);
  const [owner, setOwner] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useUploadTaskAttachments();
  const removeAttachment = useRemoveTaskAttachment();

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setPriority(task.priority ?? 0);
    setOwner(task.owner_user);
  }, [task]);

  if (!task) return null;

  // Links live in the detail text — this just makes the ones already there
  // tappable, instead of asking the user to select and copy a URL on a phone.
  const links = extractLinks(description);
  const attachments = task.attachments ?? [];
  const photos = attachments.filter((a) => a.role === "PHOTO");
  const audio = attachments.filter((a) => a.role === "AUDIO");
  const properties = task.related_labels?.properties ?? [];
  const people = task.related_labels?.people ?? [];
  const dirty =
    title !== task.title ||
    description !== (task.description ?? "") ||
    priorityBucket(priority) !== priorityBucket(task.priority) ||
    owner !== task.owner_user;

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <>
      <ResponsiveSheet
        open={!!task}
        onOpenChange={onOpenChange}
        title="Tarea"
        desktopClassName="max-w-lg"
      >
        <div className="mt-2 space-y-4">
          <Field label="Título">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>

          <Field label="Detalle">
            <Textarea
              rows={3}
              value={description}
              placeholder="Notas, links, lo que haga falta…"
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          {links.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {links.map((href) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex max-w-full items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[12.5px] font-medium text-foreground"
                >
                  <LinkIcon className="size-3 shrink-0" strokeWidth={2} />
                  <span className="truncate">{linkLabel(href)}</span>
                </a>
              ))}
            </div>
          )}

          <div>
            <p className="mb-1.5 text-[13px] font-medium text-muted-foreground">Prioridad</p>
            <Chips>
              {PRIORITIES.map((p) => (
                <Chip
                  key={p.value}
                  active={priorityBucket(priority) === p.value}
                  onClick={() => setPriority(p.value)}
                >
                  {p.label}
                </Chip>
              ))}
            </Chips>
          </div>

          {members && members.length > 1 && (
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-muted-foreground">Responsable</p>
              <Chips>
                <Chip active={!owner} onClick={() => setOwner(null)}>
                  Sin asignar
                </Chip>
                {members.map((m) => (
                  <Chip key={m.id} active={owner === m.id} onClick={() => setOwner(m.id)}>
                    <Avatar size="sm" className="mr-1.5 size-4">
                      {m.avatar_url && <AvatarImage src={m.avatar_url} alt="" />}
                      <AvatarFallback className="text-[9px]">
                        {initials(m.full_name ?? "?")}
                      </AvatarFallback>
                    </Avatar>
                    {m.full_name ?? "Sin nombre"}
                  </Chip>
                ))}
              </Chips>
            </div>
          )}

          {/* Photos and voice memos. A task used to be a title and a date, so
              "the photo of the damp patch" had to live in a note that merely
              mentioned the task by name. */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[13px] font-medium text-muted-foreground">Adjuntos</p>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 rounded-full"
                onClick={() => fileRef.current?.click()}
                disabled={upload.isPending}
              >
                {upload.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ImagePlus className="size-4" strokeWidth={1.9} />
                )}
                Agregar
              </Button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              aria-label="Adjuntar fotos"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                if (picked.length) upload.mutate({ taskId: task.id, files: picked });
                e.target.value = "";
              }}
            />
            {photos.length > 0 && (
              <div className="flex gap-2 overflow-x-auto">
                {photos.map((a) => (
                  <span key={a.id} className="relative shrink-0">
                    <img
                      src={a.thumb_url ?? a.url}
                      alt={a.title ?? ""}
                      loading="lazy"
                      className="size-20 rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      aria-label="Quitar adjunto"
                      onClick={() => removeAttachment.mutate({ taskId: task.id, assetId: a.id })}
                      className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white"
                    >
                      <X className="size-3" strokeWidth={2.4} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {audio.map((a) => (
              <AudioPlayer key={a.id} src={a.url} />
            ))}
            {photos.length === 0 && audio.length === 0 && (
              <p className="text-[12.5px] text-faint">Sin fotos todavía.</p>
            )}
          </div>

          {(properties.length > 0 || people.length > 0) && (
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-muted-foreground">
                Relacionado con
              </p>
              <div className="space-y-1.5">
                {properties.map((p) => (
                  <LinkRow
                    key={p.id}
                    icon={Building2}
                    label={p.label ?? "Propiedad"}
                    onClick={() => go(`/${role}/propiedades/${p.id}`)}
                  />
                ))}
                {people.map((p) => (
                  <LinkRow
                    key={p.id}
                    icon={User}
                    label={p.label ?? "Persona"}
                    onClick={() => go(`/${role}/personas/${p.id}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {task.status === "DONE" && <Pill tone="success">Completada</Pill>}

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
              disabled={!dirty || saving || !title.trim()}
              onClick={() =>
                onSave(task.id, {
                  title: title.trim(),
                  description: description.trim() || null,
                  priority,
                  owner_user: owner,
                })
              }
            >
              Guardar
            </Button>
          </SheetActions>
        </div>
      </ResponsiveSheet>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Eliminar tarea"
        description={`"${task.title}" se elimina para todo el equipo.`}
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={() => {
          setConfirming(false);
          onDelete(task.id);
          onOpenChange(false);
        }}
      />
    </>
  );
}

function LinkRow({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Building2;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-xl bg-card px-3 py-2.5 text-left transition active:scale-[0.99]"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.9} />
      <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-foreground">
        {label}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
    </button>
  );
}

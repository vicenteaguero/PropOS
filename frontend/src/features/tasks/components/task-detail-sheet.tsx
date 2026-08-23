import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ImagePlus, Link as LinkIcon, Loader2, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Chip,
  Chips,
  FilterSelect,
  LinkInput,
  Pill,
  ResponsiveSheet,
  SheetActions,
} from "@shared/ui";
import { ConfirmDialog } from "@shared/components/confirm-dialog/confirm-dialog";
import { PhotoViewer } from "@shared/components/photo-viewer/photo-viewer";
import { shortName, shortPropertyTitle } from "@shared/utils/display-name";
import { label } from "@shared/lib/labels";
import { dueText } from "@shared/utils/relative-time";
import { useTenantMembers } from "@shared/hooks/use-tenant-members";
import { AudioPlayer, EntityLinkRow } from "@shared/ui";
import { extractLinks, linkLabel } from "@shared/lib/links";
import { priorityBucket } from "../lib/task-order";
import { useRemoveTaskAttachment, useUploadTaskAttachments } from "../hooks/use-tasks";
import { TaskEntityPicker, linkToRelated, type TaskLink } from "./task-entity-picker";
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
  const [links, setLinks] = useState<string[]>([]);
  // The entity link, editable. It could be set when the task was created and
  // never afterwards — so a task filed against the wrong property stayed filed
  // against the wrong property for its whole life.
  const [entity, setEntity] = useState<TaskLink | null>(null);
  const [confirming, setConfirming] = useState(false);
  // Read first. Opening straight into a form makes every glance at a task an
  // edit session — one stray keystroke and the title has changed — and it puts
  // the two things people open a task FOR (the photo, the link) below three
  // text inputs.
  const [editing, setEditing] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useUploadTaskAttachments();
  const removeAttachment = useRemoveTaskAttachment();

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setPriority(task.priority ?? 0);
    setOwner(task.owner_user);
    setLinks(task.related?.links ?? extractLinks(task.description));
    const property = task.related_labels?.properties?.[0];
    const person = task.related_labels?.people?.[0];
    setEntity(
      property
        ? { kind: "PROPERTY", id: property.id, label: property.label ?? "" }
        : person
          ? { kind: "CONTACT", id: person.id, label: person.label ?? "" }
          : null,
    );
    setEditing(false);
  }, [task]);

  if (!task) return null;

  const attachments = task.attachments ?? [];
  const photos = attachments.filter((a) => a.role === "PHOTO");
  const audio = attachments.filter((a) => a.role === "AUDIO");
  const properties = task.related_labels?.properties ?? [];
  const people = task.related_labels?.people ?? [];
  const deals = task.related_labels?.opportunities ?? [];
  const savedLinks = task.related?.links ?? extractLinks(task.description);
  const savedEntityId = properties[0]?.id ?? people[0]?.id;
  const dirty =
    title !== task.title ||
    description !== (task.description ?? "") ||
    priorityBucket(priority) !== priorityBucket(task.priority) ||
    owner !== task.owner_user ||
    links.join("|") !== savedLinks.join("|") ||
    entity?.id !== savedEntityId;
  const priorityLabel = PRIORITIES.find((p) => p.value === priorityBucket(priority))?.label;
  const ownerMember = members?.find((m) => m.id === owner) ?? null;

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
          {/* Title first, then state, then the things you came for. In edit
              mode the same order holds — placeholders instead of labels above
              every field, the way the event sheet does it. */}
          {editing ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="¿Qué hay que hacer?"
              aria-label="Título"
              className="text-[16px] font-semibold"
            />
          ) : (
            <h2 className="text-[19px] font-bold leading-snug tracking-tight text-foreground">
              {title}
            </h2>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            {task.status === "DONE" ? (
              <Pill tone="success">Completada</Pill>
            ) : (
              task.due_at && <Pill tone="neutral">{dueText(task.due_at)}</Pill>
            )}
            {!editing && priorityLabel && priorityBucket(priority) > 0 && (
              <Pill tone={priorityBucket(priority) === 2 ? "destructive" : "warning"}>
                {priorityLabel}
              </Pill>
            )}
            {!editing && ownerMember && (
              <Pill tone="neutral">{shortName(ownerMember.full_name, "Sin nombre")}</Pill>
            )}
          </div>

          {/* Links, before the prose. They are the reason a task gets opened on
              a phone more often than the description is. */}
          {editing ? (
            <LinkInput value={links} onChange={setLinks} />
          ) : (
            links.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {links.map((href) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex max-w-full items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[12.5px] font-medium text-foreground"
                  >
                    <LinkIcon className="size-3 shrink-0" strokeWidth={2} />
                    <span className="truncate">{linkLabel(href)}</span>
                  </a>
                ))}
              </div>
            )
          )}

          {/* Photos and voice memos. A task used to be a title and a date, so
              "the photo of the damp patch" had to live in a note that merely
              mentioned the task by name. */}
          {(photos.length > 0 || audio.length > 0 || editing) && (
            <div>
              {editing && (
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
              )}
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
                      {/* Opens the photo. It used to be an inert 80px square,
                          so the one thing an attachment is for — looking at it
                          — was the one thing you could not do. */}
                      <button
                        type="button"
                        onClick={() => setLightbox(a.url)}
                        aria-label={a.title ? `Ver ${a.title}` : "Ver foto"}
                      >
                        <img
                          src={a.thumb_url ?? a.url}
                          alt={a.title ?? ""}
                          loading="lazy"
                          className="size-20 rounded-lg object-cover"
                        />
                      </button>
                      {editing && (
                        <button
                          type="button"
                          aria-label="Quitar adjunto"
                          onClick={() =>
                            removeAttachment.mutate({ taskId: task.id, assetId: a.id })
                          }
                          className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white"
                        >
                          <X className="size-3" strokeWidth={2.4} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
              {audio.map((a) => (
                <AudioPlayer key={a.id} src={a.url} />
              ))}
              {editing && photos.length === 0 && audio.length === 0 && (
                <p className="text-[12.5px] text-faint">Sin fotos todavía.</p>
              )}
            </div>
          )}

          {(properties.length > 0 || people.length > 0 || deals.length > 0) && (
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-muted-foreground">
                Relacionado con
              </p>
              <div className="space-y-1.5">
                {properties.map((p) => (
                  <EntityLinkRow
                    key={p.id}
                    kind="PROPERTY"
                    label={shortPropertyTitle(p.label)}
                    onClick={() => go(`/${role}/propiedades/${p.id}`)}
                  />
                ))}
                {people.map((p) => (
                  <EntityLinkRow
                    key={p.id}
                    kind="CONTACT"
                    label={shortName(p.label, "Sin nombre")}
                    onClick={() => go(`/${role}/personas/${p.id}`)}
                  />
                ))}
                {deals.map((d) => (
                  <EntityLinkRow
                    key={d.id}
                    kind="DEAL"
                    label={d.label ?? "Negocio"}
                    onClick={() => go(`/${role}/negocios/${d.id}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Description last: it is the least-read part of a task and the
              tallest, so leading with it pushed everything else off screen. */}
          {editing ? (
            <Textarea
              rows={3}
              value={description}
              placeholder="Notas, contexto, lo que haga falta…"
              aria-label="Detalle"
              onChange={(e) => setDescription(e.target.value)}
            />
          ) : (
            description.trim() && (
              <p className="break-words whitespace-pre-wrap text-[14px] leading-relaxed text-muted-foreground">
                {description}
              </p>
            )
          )}

          {editing && (
            <>
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

              <div>
                <p className="mb-1.5 text-[13px] font-medium text-muted-foreground">Vincular a</p>
                <TaskEntityPicker value={entity} onChange={setEntity} disabled={saving} />
              </div>

              {members && members.length > 1 && (
                <div>
                  {/* A dropdown, not a chip per teammate. Each chip carried a 16px
                      avatar, so a four-person team came to ~773px inside a
                      328px sheet — and it gets worse as the brokerage grows,
                      which is the wrong direction for a control to scale. */}
                  <FilterSelect
                    label="Responsable"
                    value={owner}
                    allLabel="Sin asignar"
                    options={members.map((m) => ({
                      value: m.id,
                      label: shortName(m.full_name, "Sin nombre"),
                      sub: label("role", m.role),
                    }))}
                    onChange={setOwner}
                  />{" "}
                </div>
              )}
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
                  disabled={!dirty || saving || !title.trim()}
                  onClick={() => {
                    onSave(task.id, {
                      title: title.trim(),
                      description: description.trim() || null,
                      priority,
                      owner_user: owner,
                      // `linkToRelated` merges rather than replaces, so the
                      // deal key and the URLs survive a change of property.
                      related: {
                        ...(linkToRelated(entity, task.related ?? {}) ?? {}),
                        links,
                      },
                    });
                    setEditing(false);
                  }}
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

      {/* The photo, full size. `PhotoViewer` is what the property gallery uses,
          so a task photo behaves the same as every other photo in the app. */}
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

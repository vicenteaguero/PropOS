import { useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, Globe, Lock, Plus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FilterSelect,
  FOCUS_RING,
  ListShell,
  Pill,
  SectionTabs,
  TOUCH_TARGET_ROW,
  type PillTone,
  type SectionTab,
} from "@shared/ui";
import { PageLayout } from "@shared/components/page-layout";
import { PageHeader } from "@shared/components/page-header";
import { usePageTitle } from "@app/page-meta";
import { label } from "@shared/lib/labels";
import { MessageTemplateSheet } from "../components/message-template-sheet";
import { PipelineSheet } from "../components/pipeline-sheet";
import { TagSheet } from "../components/tag-sheet";
import { ChecklistTemplateSheet } from "../components/checklist-template-sheet";
import { TemplateBody } from "../components/template-body";
import {
  useChecklistTemplates,
  useDeleteChecklistTemplate,
  useDeleteMessageTemplate,
  useMessageTemplates,
  useDeletePipeline,
  useDeleteTag,
  usePipelines,
  useSaveChecklistTemplate,
  useSaveMessageTemplate,
  useSavePipeline,
  useSaveTag,
  useTags,
} from "../hooks/use-catalogs";
import {
  isSendable,
  matchesQuery,
  sortTemplates,
  type ApprovalStatus,
  type MessageTemplate,
} from "../lib/message-templates";
import { horizonDays, type ChecklistTemplate } from "../lib/checklist-templates";
import { isUnconstrained, summarize, type Pipeline } from "../lib/pipelines";
import { sortTags, unusedTags, type Tag } from "../lib/tags";

const STATUS_TONE: Record<ApprovalStatus, PillTone> = {
  approved: "success",
  submitted: "warning",
  rejected: "destructive",
  draft: "neutral",
};

const STATUS_OPTIONS: ApprovalStatus[] = ["approved", "submitted", "rejected", "draft"];

/** A row's own gutter matches `Row`'s, so both tabs align with every other list. */
const ROW = "w-full px-[var(--page-x)] py-3 text-left border-b border-border";

function TemplateRow({ template, onOpen }: { template: MessageTemplate; onOpen: () => void }) {
  const sendable = isSendable(template);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        ROW,
        TOUCH_TARGET_ROW,
        FOCUS_RING,
        "transition hover:bg-secondary/50 active:scale-[0.995]",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-mono text-[14px] font-semibold text-foreground">
          {template.name}
        </span>
        <Pill tone={STATUS_TONE[template.approval_status]}>
          {label("templateApprovalStatus", template.approval_status)}
        </Pill>
        <ChevronRight className="size-4 shrink-0 text-faint" strokeWidth={1.8} />
      </div>

      <TemplateBody body={template.body} variables={template.variables} clamp className="mt-1.5" />

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[12px] text-faint">
        <span>{label("channel", template.channel)}</span>
        <span aria-hidden>·</span>
        <span>{label("templateCategory", template.category)}</span>
        <span aria-hidden>·</span>
        <span className="font-mono uppercase">{template.language}</span>
        {!sendable && (
          <>
            <span aria-hidden>·</span>
            {/* The operative consequence of the badge above, stated where it
                matters: outside the window Meta drops anything unapproved. */}
            <span className="font-medium text-warning">sólo dentro de las 24 h</span>
          </>
        )}
      </div>
    </button>
  );
}

function MessageTemplatesTab() {
  const { data, isPending, isError, error, refetch } = useMessageTemplates();
  const save = useSaveMessageTemplate();
  const remove = useDeleteMessageTemplate();

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [channel, setChannel] = useState<string | null>(null);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [open, setOpen] = useState(false);

  const all = useMemo(() => sortTemplates(data ?? []), [data]);
  const rows = all.filter(
    (t) =>
      matchesQuery(t, query) &&
      (!status || t.approval_status === status) &&
      (!channel || t.channel === channel),
  );
  const sendable = all.filter(isSendable).length;

  const openSheet = (template: MessageTemplate | null) => {
    setEditing(template);
    setOpen(true);
  };

  return (
    <>
      <ListShell
        titleSr="Plantillas"
        // Not a subtitle: the one number that decides whether this catalog is
        // any use, since only an approved template survives the 24 h window.
        meta={
          all.length > 0 ? `${sendable} de ${all.length} se pueden enviar fuera de las 24 h` : null
        }
        search={{ value: query, onChange: setQuery, placeholder: "Buscar plantilla..." }}
        action={
          <Button size="sm" onClick={() => openSheet(null)}>
            <Plus className="size-4" strokeWidth={2} />
            Nueva
          </Button>
        }
        filters={
          <div className="flex flex-wrap gap-1.5">
            <FilterSelect
              label="Estado"
              value={status}
              onChange={setStatus}
              allLabel="Todos"
              options={STATUS_OPTIONS.map((value) => ({
                value,
                label: label("templateApprovalStatus", value),
                sub: `${all.filter((t) => t.approval_status === value).length}`,
              }))}
            />
            <FilterSelect
              label="Canal"
              value={channel}
              onChange={setChannel}
              allLabel="Todos"
              options={[
                { value: "whatsapp", label: "WhatsApp" },
                { value: "email", label: "Correo" },
              ]}
            />
          </div>
        }
        isLoading={isPending}
        error={isError ? error : undefined}
        onRetry={() => refetch()}
        errorMessage="No se pudieron cargar las plantillas."
        isEmpty={rows.length === 0}
        emptyTitle={all.length === 0 ? "Sin plantillas" : "Nada con esos filtros"}
        emptyAction={
          all.length === 0
            ? { label: "Crear plantilla", onClick: () => openSheet(null) }
            : undefined
        }
      >
        {rows.map((template) => (
          <TemplateRow key={template.id} template={template} onOpen={() => openSheet(template)} />
        ))}
      </ListShell>

      <MessageTemplateSheet
        open={open}
        template={editing}
        onOpenChange={setOpen}
        saving={save.isPending}
        onSave={(values) =>
          save.mutate({ id: editing?.id, values }, { onSuccess: () => setOpen(false) })
        }
        onDelete={
          editing ? () => remove.mutate(editing.id, { onSuccess: () => setOpen(false) }) : undefined
        }
      />
    </>
  );
}

function ChecklistRow({ template, onOpen }: { template: ChecklistTemplate; onOpen: () => void }) {
  const blocking = template.items.filter((item) => item.blocking);
  const horizon = horizonDays(template.items);
  // The blocking steps ARE the list: the rest is a reminder. Naming the first
  // few answers "what does this one enforce" without opening the editor, which
  // a count alone never does.
  const shown = blocking.slice(0, 3);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        ROW,
        TOUCH_TARGET_ROW,
        FOCUS_RING,
        "transition hover:bg-secondary/50 active:scale-[0.995]",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground">
          {template.name}
        </span>
        {template.is_default && <Pill tone="accent">Se abre sola</Pill>}
        <ChevronRight className="size-4 shrink-0 text-faint" strokeWidth={1.8} />
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
        <span>{label("operationKind", template.operation_kind)}</span>
        <span aria-hidden>·</span>
        <span>{template.items.length} pasos</span>
        {horizon !== null && (
          <>
            <span aria-hidden>·</span>
            <span>hasta el día {horizon}</span>
          </>
        )}
      </div>

      {blocking.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-destructive">
            <Lock className="size-3.5" strokeWidth={2} />
            {blocking.length} frenan el cierre
          </span>
          {shown.map((item) => (
            <span
              key={item.position}
              className="max-w-[14rem] truncate rounded-full bg-destructive/12 px-2 py-0.5 text-[12px] text-destructive"
            >
              {item.title}
            </span>
          ))}
          {blocking.length > shown.length && (
            <span className="text-[12px] text-faint">+{blocking.length - shown.length}</span>
          )}
        </div>
      )}
    </button>
  );
}

function ChecklistTemplatesTab() {
  const { data, isPending, isError, error, refetch } = useChecklistTemplates();
  const save = useSaveChecklistTemplate();
  const remove = useDeleteChecklistTemplate();

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ChecklistTemplate | null>(null);
  const [open, setOpen] = useState(false);

  const all = data ?? [];
  const rows = all.filter((t) => t.name.toLowerCase().includes(query.trim().toLowerCase()));

  const openSheet = (template: ChecklistTemplate | null) => {
    setEditing(template);
    setOpen(true);
  };

  return (
    <>
      <ListShell
        titleSr="Listas de cierre"
        meta={all.length > 0 ? `${all.length} listas` : null}
        search={{ value: query, onChange: setQuery, placeholder: "Buscar lista..." }}
        action={
          <Button size="sm" onClick={() => openSheet(null)}>
            <Plus className="size-4" strokeWidth={2} />
            Nueva
          </Button>
        }
        isLoading={isPending}
        error={isError ? error : undefined}
        onRetry={() => refetch()}
        errorMessage="No se pudieron cargar las listas."
        isEmpty={rows.length === 0}
        emptyTitle={all.length === 0 ? "Sin listas de cierre" : "Nada con ese nombre"}
        emptyAction={
          all.length === 0 ? { label: "Crear lista", onClick: () => openSheet(null) } : undefined
        }
      >
        {rows.map((template) => (
          <ChecklistRow key={template.id} template={template} onOpen={() => openSheet(template)} />
        ))}
      </ListShell>

      <ChecklistTemplateSheet
        open={open}
        template={editing}
        onOpenChange={setOpen}
        saving={save.isPending}
        onSave={(values) =>
          save.mutate({ id: editing?.id, values }, { onSuccess: () => setOpen(false) })
        }
        onDelete={
          editing ? () => remove.mutate(editing.id, { onSuccess: () => setOpen(false) }) : undefined
        }
      />
    </>
  );
}

function PipelineRow({ pipeline, onOpen }: { pipeline: Pipeline; onOpen: () => void }) {
  const summary = summarize(pipeline.transitions);
  const open = isUnconstrained(pipeline.transitions);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        ROW,
        TOUCH_TARGET_ROW,
        FOCUS_RING,
        "transition hover:bg-secondary/50 active:scale-[0.995]",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground">
          {pipeline.name}
        </span>
        {pipeline.is_default && <Pill tone="accent">Por defecto</Pill>}
        <ChevronRight className="size-4 shrink-0 text-faint" strokeWidth={1.8} />
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
        <span>{pipeline.stages.length} etapas</span>
        <span aria-hidden>·</span>
        <span>{pipeline.deal_count} negocios</span>
      </div>

      {/* A pipeline with no rules is not a tidy pipeline: `assert_allowed`
          treats it as unconstrained, so the row has to lead with that rather
          than showing a reassuring "0 movimientos". */}
      {open ? (
        <span className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-warning">
          <AlertTriangle className="size-3.5" strokeWidth={2} />
          Sin reglas: cualquier movimiento permitido
        </span>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
          <span className="text-faint">{summary.declared} movimientos</span>
          {summary.human > 0 && (
            <span className="inline-flex items-center gap-1.5 font-medium text-warning">
              <UserRound className="size-3.5" strokeWidth={2} />
              {summary.human} sólo persona
            </span>
          )}
          {summary.fromAny > 0 && (
            <span className="inline-flex items-center gap-1.5 text-accent-brand">
              <Globe className="size-3.5" strokeWidth={2} />
              {summary.fromAny} desde cualquier etapa
            </span>
          )}
        </div>
      )}
    </button>
  );
}

function PipelinesTab() {
  const { data, isPending, isError, error, refetch } = usePipelines();
  const save = useSavePipeline();
  const remove = useDeletePipeline();

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Pipeline | null>(null);
  const [open, setOpen] = useState(false);

  const all = data ?? [];
  const rows = all.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));
  const unconstrained = all.filter((p) => isUnconstrained(p.transitions)).length;

  const openSheet = (pipeline: Pipeline | null) => {
    setEditing(pipeline);
    setOpen(true);
  };

  return (
    <>
      <ListShell
        titleSr="Pipelines"
        meta={
          unconstrained > 0
            ? `${unconstrained} sin reglas declaradas`
            : all.length > 0
              ? `${all.length} pipelines`
              : null
        }
        search={{ value: query, onChange: setQuery, placeholder: "Buscar pipeline..." }}
        action={
          <Button size="sm" onClick={() => openSheet(null)}>
            <Plus className="size-4" strokeWidth={2} />
            Nuevo
          </Button>
        }
        isLoading={isPending}
        error={isError ? error : undefined}
        onRetry={() => refetch()}
        errorMessage="No se pudieron cargar los pipelines."
        isEmpty={rows.length === 0}
        emptyTitle={all.length === 0 ? "Sin pipelines" : "Nada con ese nombre"}
        emptyAction={
          all.length === 0 ? { label: "Crear pipeline", onClick: () => openSheet(null) } : undefined
        }
      >
        {rows.map((pipeline) => (
          <PipelineRow key={pipeline.id} pipeline={pipeline} onOpen={() => openSheet(pipeline)} />
        ))}
      </ListShell>

      <PipelineSheet
        open={open}
        pipeline={editing}
        onOpenChange={setOpen}
        saving={save.isPending}
        onSave={(values) =>
          save.mutate({ id: editing?.id, values }, { onSuccess: () => setOpen(false) })
        }
        onDelete={
          editing ? () => remove.mutate(editing.id, { onSuccess: () => setOpen(false) }) : undefined
        }
      />
    </>
  );
}

function TagRow({ tag, onOpen }: { tag: Tag; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        ROW,
        TOUCH_TARGET_ROW,
        FOCUS_RING,
        "flex items-center gap-3 transition hover:bg-secondary/50 active:scale-[0.995]",
      )}
    >
      <span
        aria-hidden
        className="size-3 shrink-0 rounded-full border border-line-strong"
        style={tag.color ? { backgroundColor: tag.color, borderColor: tag.color } : undefined}
      />
      <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-foreground">
        {tag.name}
      </span>
      {/* An unused tag is not neutral: it is an option offered in every picker
          that nobody ever picks. */}
      <span
        className={cn(
          "shrink-0 font-mono text-[12px] tabular-nums",
          tag.usage_count === 0 ? "text-faint" : "text-muted-foreground",
        )}
      >
        {tag.usage_count === 0 ? (
          "sin uso"
        ) : (
          <>
            {tag.usage_count}
            <span className="hidden sm:inline"> usos</span>
          </>
        )}
      </span>
      <ChevronRight className="size-4 shrink-0 text-faint" strokeWidth={1.8} />
    </button>
  );
}

function TagsTab() {
  const { data, isPending, isError, error, refetch } = useTags();
  const save = useSaveTag();
  const remove = useDeleteTag();

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Tag | null>(null);
  const [open, setOpen] = useState(false);

  const all = useMemo(() => sortTags(data ?? []), [data]);
  const rows = all.filter((t) => t.name.toLowerCase().includes(query.trim().toLowerCase()));
  const unused = unusedTags(all).length;

  const openSheet = (tag: Tag | null) => {
    setEditing(tag);
    setOpen(true);
  };

  return (
    <>
      <ListShell
        titleSr="Etiquetas"
        meta={
          all.length > 0
            ? unused > 0
              ? `${all.length} etiquetas · ${unused} sin uso`
              : `${all.length} etiquetas`
            : null
        }
        search={{ value: query, onChange: setQuery, placeholder: "Buscar etiqueta..." }}
        action={
          <Button size="sm" onClick={() => openSheet(null)}>
            <Plus className="size-4" strokeWidth={2} />
            Nueva
          </Button>
        }
        isLoading={isPending}
        error={isError ? error : undefined}
        onRetry={() => refetch()}
        errorMessage="No se pudieron cargar las etiquetas."
        isEmpty={rows.length === 0}
        emptyTitle={all.length === 0 ? "Sin etiquetas" : "Nada con ese nombre"}
        emptyAction={
          all.length === 0 ? { label: "Crear etiqueta", onClick: () => openSheet(null) } : undefined
        }
      >
        {rows.map((tag) => (
          <TagRow key={tag.id} tag={tag} onOpen={() => openSheet(tag)} />
        ))}
      </ListShell>

      <TagSheet
        open={open}
        tag={editing}
        existing={all}
        onOpenChange={setOpen}
        saving={save.isPending}
        onSave={(values) =>
          save.mutate({ id: editing?.id, values }, { onSuccess: () => setOpen(false) })
        }
        onDelete={
          editing ? () => remove.mutate(editing.id, { onSuccess: () => setOpen(false) }) : undefined
        }
      />
    </>
  );
}

/**
 * Configuración → Clientes: the two vocabularies a brokerage owns.
 *
 * `message_templates` and `checklist_templates` were moved out of Python
 * constants and into tables precisely so that adding a WhatsApp template or
 * reordering a closing checklist would stop being a deploy — and then had no
 * screen, which left them exactly as frozen as the constants had been. This is
 * that screen.
 */
export function ClientsCatalogsPage() {
  usePageTitle("Clientes");

  const tabs: SectionTab[] = [
    { id: "plantillas", label: "Plantillas", render: () => <MessageTemplatesTab /> },
    { id: "listas", label: "Listas de cierre", render: () => <ChecklistTemplatesTab /> },
    { id: "pipelines", label: "Pipelines", render: () => <PipelinesTab /> },
    { id: "etiquetas", label: "Etiquetas", render: () => <TagsTab /> },
  ];

  return (
    <PageLayout width="md" noPadding className="flex min-h-0 flex-col pb-16">
      <div className="px-[var(--page-x)] pt-5">
        <PageHeader title="Clientes" backTo="/admin/settings" className="mb-2" />
      </div>
      <SectionTabs tabs={tabs} />
    </PageLayout>
  );
}

export default ClientsCatalogsPage;

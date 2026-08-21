import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  catalogsApi,
  pipelinesApi,
  tagsApi,
  type ChecklistTemplateWrite,
  type MessageTemplateWrite,
  type PipelineWrite,
  type TagWrite,
} from "../api/catalogs-api";

const TEMPLATES_KEY = ["settings", "message-templates"] as const;
const CHECKLISTS_KEY = ["settings", "checklist-templates"] as const;

function failed(fallback: string) {
  return (error: unknown) => toast.error(error instanceof Error ? error.message : fallback);
}

export function useMessageTemplates() {
  return useQuery({ queryKey: TEMPLATES_KEY, queryFn: () => catalogsApi.listMessageTemplates() });
}

/**
 * One mutation for create and update.
 *
 * Not optimistic: the server can change the outcome of a save — editing an
 * approved body drops it back to `draft`, because Meta approved the text and
 * not the row. Painting the sent state would show "Aprobada" on a template
 * that just stopped being sendable, which is the one thing this screen exists
 * to get right.
 */
export function useSaveMessageTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: MessageTemplateWrite }) =>
      id
        ? catalogsApi.updateMessageTemplate(id, values)
        : catalogsApi.createMessageTemplate(values),
    onSuccess: (saved, { id }) => {
      qc.invalidateQueries({ queryKey: TEMPLATES_KEY });
      if (saved.approval_status === "draft" && id) {
        toast.success("Guardada como borrador: el texto cambió y Meta debe aprobarla de nuevo.");
      } else {
        toast.success("Plantilla guardada");
      }
    },
    onError: failed("No se pudo guardar la plantilla"),
  });
}

export function useDeleteMessageTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => catalogsApi.deleteMessageTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TEMPLATES_KEY });
      toast.success("Plantilla eliminada");
    },
    onError: failed("No se pudo eliminar la plantilla"),
  });
}

export function useChecklistTemplates() {
  return useQuery({
    queryKey: CHECKLISTS_KEY,
    queryFn: () => catalogsApi.listChecklistTemplates(),
  });
}

export function useSaveChecklistTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: ChecklistTemplateWrite }) =>
      id
        ? catalogsApi.updateChecklistTemplate(id, values)
        : catalogsApi.createChecklistTemplate(values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHECKLISTS_KEY });
      toast.success("Lista guardada");
    },
    onError: failed("No se pudo guardar la lista"),
  });
}

export function useDeleteChecklistTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => catalogsApi.deleteChecklistTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHECKLISTS_KEY });
      toast.success("Lista eliminada");
    },
    onError: failed("No se pudo eliminar la lista"),
  });
}

const PIPELINES_KEY = ["settings", "pipelines"] as const;
const TAGS_KEY = ["settings", "tags"] as const;

export function usePipelines() {
  return useQuery({ queryKey: PIPELINES_KEY, queryFn: () => pipelinesApi.list() });
}

export function useSavePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: PipelineWrite }) =>
      id ? pipelinesApi.update(id, values) : pipelinesApi.create(values),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: PIPELINES_KEY });
      // Saying "guardado" over a pipeline that now permits everything would be
      // technically true and practically a lie.
      if (saved.transitions.length === 0) {
        toast.warning("Guardado sin reglas: cualquier movimiento queda permitido.");
      } else {
        toast.success("Pipeline guardado");
      }
    },
    onError: failed("No se pudo guardar el pipeline"),
  });
}

export function useDeletePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pipelinesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PIPELINES_KEY });
      toast.success("Pipeline eliminado");
    },
    onError: failed("No se pudo eliminar el pipeline"),
  });
}

export function useTags() {
  return useQuery({ queryKey: TAGS_KEY, queryFn: () => tagsApi.list() });
}

export function useSaveTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: TagWrite }) =>
      id ? tagsApi.update(id, values) : tagsApi.create(values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TAGS_KEY });
      toast.success("Etiqueta guardada");
    },
    onError: failed("No se pudo guardar la etiqueta"),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tagsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TAGS_KEY });
      toast.success("Etiqueta eliminada");
    },
    onError: failed("No se pudo eliminar la etiqueta"),
  });
}

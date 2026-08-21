import { apiRequest } from "@shared/api/http";
import type { MessageTemplate } from "../lib/message-templates";
import type { ChecklistTemplate } from "../lib/checklist-templates";
import type { Pipeline, PipelineTransition } from "../lib/pipelines";
import type { Tag } from "../lib/tags";

const BASE = "/v1/settings";

export interface MessageTemplateWrite {
  name: string;
  channel: MessageTemplate["channel"];
  category: MessageTemplate["category"];
  language: string;
  body: string;
  variables: string[];
  external_name: string | null;
  approval_status: MessageTemplate["approval_status"];
}

export interface ChecklistItemWrite {
  title: string;
  description: string | null;
  blocking: boolean;
  owner_role: string | null;
  due_offset_days: number | null;
  document_kind: string | null;
}

export interface ChecklistTemplateWrite {
  name: string;
  operation_kind: string;
  is_default: boolean;
  /** The whole list, in order. The server renumbers from the array position. */
  items: ChecklistItemWrite[];
}

export const catalogsApi = {
  listMessageTemplates: () => apiRequest<MessageTemplate[]>(`${BASE}/message-templates`),

  createMessageTemplate: (body: MessageTemplateWrite) =>
    apiRequest<MessageTemplate>(`${BASE}/message-templates`, { method: "POST", body }),

  updateMessageTemplate: (id: string, body: MessageTemplateWrite) =>
    apiRequest<MessageTemplate>(`${BASE}/message-templates/${id}`, { method: "PUT", body }),

  deleteMessageTemplate: (id: string) =>
    apiRequest<void>(`${BASE}/message-templates/${id}`, { method: "DELETE" }),

  listChecklistTemplates: () => apiRequest<ChecklistTemplate[]>(`${BASE}/checklist-templates`),

  createChecklistTemplate: (body: ChecklistTemplateWrite) =>
    apiRequest<ChecklistTemplate>(`${BASE}/checklist-templates`, { method: "POST", body }),

  updateChecklistTemplate: (id: string, body: ChecklistTemplateWrite) =>
    apiRequest<ChecklistTemplate>(`${BASE}/checklist-templates/${id}`, { method: "PUT", body }),

  deleteChecklistTemplate: (id: string) =>
    apiRequest<void>(`${BASE}/checklist-templates/${id}`, { method: "DELETE" }),
};

export interface PipelineWrite {
  name: string;
  stages: string[];
  is_default: boolean;
  /** The whole rule set. An empty array switches the state machine off. */
  transitions: PipelineTransition[];
}

export interface TagWrite {
  name: string;
  color: string | null;
}

export const pipelinesApi = {
  list: () => apiRequest<Pipeline[]>(`${BASE}/pipelines`),
  create: (body: PipelineWrite) =>
    apiRequest<Pipeline>(`${BASE}/pipelines`, { method: "POST", body }),
  update: (id: string, body: PipelineWrite) =>
    apiRequest<Pipeline>(`${BASE}/pipelines/${id}`, { method: "PUT", body }),
  remove: (id: string) => apiRequest<void>(`${BASE}/pipelines/${id}`, { method: "DELETE" }),
};

export const tagsApi = {
  list: () => apiRequest<Tag[]>(`${BASE}/tags`),
  create: (body: TagWrite) => apiRequest<Tag>(`${BASE}/tags`, { method: "POST", body }),
  update: (id: string, body: TagWrite) =>
    apiRequest<Tag>(`${BASE}/tags/${id}`, { method: "PUT", body }),
  remove: (id: string) => apiRequest<void>(`${BASE}/tags/${id}`, { method: "DELETE" }),
};

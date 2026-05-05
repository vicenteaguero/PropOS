-- Add a free-form quick-tag column on documents so the fast-add UI can stamp
-- a category (e.g. ID, Contrato, Boleta, Otro) without forcing a strict enum.
-- Kept nullable; existing rows default to NULL.
alter table public.documents
  add column if not exists tag text;

create index if not exists documents_tag_idx
  on public.documents (tenant_id, tag)
  where tag is not null;

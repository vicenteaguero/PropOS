-- =====================================================================
-- Migration: title_study baseline
-- File:     supabase/migrations/<n>_title_study_baseline.sql (DRAFT)
-- Purpose:  Pre-listing title-safeguard schema for PropOS.
--           Implements Tier 1 (deterministic), Tier 2 (LLM-extract) and
--           Tier 3 (LLM-judgement + HITL) flag pipeline persistence.
--
-- Conventions (PropOS):
--   * code/identifiers in English
--   * multi-tenant via organization_id (FK profiles/orgs - assumed
--     existing). RLS placeholders only; full policies live in a
--     dedicated _rls migration once we settle tenant model.
--   * audit fields created_at / updated_at with universal trigger
--     (existing tg_set_updated_at and tg_audit_event in PropOS).
--   * money in CLP integer (no fractional centavos).
-- =====================================================================

begin;

-- Pre-existing tables we FK into (do NOT recreate):
--   public.properties (id uuid pk)
--   public.profiles   (id uuid pk -> auth.users)
--   public.people     (id uuid pk - CRM contacts/lawyers)
--   public.organizations (id uuid pk)
--   public.media_files (id uuid pk - generic file blob)
--
-- If any of those names drift, adjust REFERENCES below.

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------

create type title_study_status as enum (
  'draft',
  'collecting',     -- waiting for CBR docs / external pulls
  'extracting',     -- LLM tier-2 running
  'analyzing',      -- rule engine + tier-3 running
  'awaiting_review',-- HITL: lawyer must look
  'green',
  'yellow',
  'red',
  'archived'
);

create type cbr_document_kind as enum (
  'dominio_vigente',
  'gravamenes_prohibiciones',
  'carpeta_10_anos',
  'copia_inscripcion',
  'copia_escritura',
  'indice_propiedad',
  'reglamento_copropiedad',
  'plano_archivado'
);

create type cbr_document_status as enum (
  'pending',
  'requested',
  'in_progress',
  'delivered',
  'parsed',
  'failed',
  'cancelled'
);

create type title_chain_link_kind as enum (
  'compraventa',
  'donacion',
  'permuta',
  'aporte_sociedad',
  'adjudicacion_particion',
  'inscripcion_especial_herencia',
  'posesion_efectiva',
  'remate_judicial',
  'dacion_pago',
  'saneamiento_dl_2695',
  'expropiacion',
  'rectificacion',
  'otro'
);

create type title_flag_severity as enum ('green', 'yellow', 'red');
create type title_flag_tier     as enum ('tier_1', 'tier_2', 'tier_3');

create type external_data_source as enum (
  'sii',
  'tgr',
  'dom_minvu',
  'minvu_cne',
  'mop_vialidad',
  'dga',
  'sea_seia',
  'cmn',
  'mma',
  'sbap',
  'ssffaa',
  'conadi',
  'registro_civil',
  'minvu_ide',
  'sec',
  'sag'
);

create type study_decision_outcome as enum (
  'accept_listing',
  'accept_with_conditions',
  'request_remediation',
  'reject_listing',
  'escalate_lawyer'
);

-- ---------------------------------------------------------------------
-- title_flag_catalog
--   Static (seeded) catalog of all known flag codes.
--   FK target for title_flags.flag_code.
-- ---------------------------------------------------------------------

create table title_flag_catalog (
  flag_code           text primary key,
  case_id             text not null unique, -- T01, R01, D01...
  display_name_es     text not null,
  description_es      text not null,
  remediation_es      text not null,
  default_severity    title_flag_severity not null,
  default_tier        title_flag_tier not null,
  detection_automation text not null check (detection_automation in
                       ('full','partial','human-only')),
  legal_sources       jsonb not null default '[]'::jsonb,
                       -- e.g. [{"law":"art 1749 CC"},{"caso":"CS rol 19261-2018"}]
  fix_time_days_min   integer,
  fix_time_days_max   integer,
  fix_cost_clp_min    integer,
  fix_cost_clp_max    integer,
  prompt_hint         text,    -- canonical retrieval hint for tier-2/3
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table title_flag_catalog is
  'Versioned catalog of pre-listing risk flags (~38 cases). Seeded from cases_taxonomy.csv.';

-- ---------------------------------------------------------------------
-- title_studies
--   One row per intent-of-listing for a property.
-- ---------------------------------------------------------------------

create table title_studies (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  property_id         uuid not null references properties(id) on delete cascade,
  requested_by        uuid not null references profiles(id),
  assigned_lawyer_id  uuid references people(id),
  status              title_study_status not null default 'draft',
  current_severity    title_flag_severity, -- denormalized worst-flag, refreshed via trigger
  cbr_jurisdiction    text,                -- e.g. 'CBR Santiago'
  fna_foja            integer,             -- starting inscription
  fna_numero          integer,
  fna_anio            smallint,
  rut_propietario     text,                -- normalized 11.111.111-1
  direccion_libre     text,                -- broker free-text input
  llm_provider        text not null default 'anthropic',
  llm_model           text not null default 'claude-sonnet-4-6',
  llm_total_input_tokens  bigint not null default 0,
  llm_total_output_tokens bigint not null default 0,
  cost_clp_estimated  integer not null default 0,
  started_at          timestamptz not null default now(),
  completed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  metadata            jsonb not null default '{}'::jsonb
);

create index idx_title_studies_property      on title_studies(property_id);
create index idx_title_studies_org_status    on title_studies(organization_id, status);
create index idx_title_studies_lawyer        on title_studies(assigned_lawyer_id)
  where assigned_lawyer_id is not null;
create index idx_title_studies_fna           on title_studies(cbr_jurisdiction, fna_foja, fna_numero, fna_anio);

-- ---------------------------------------------------------------------
-- cbr_documents
--   Documents requested to a CBR. Async lifecycle.
-- ---------------------------------------------------------------------

create table cbr_documents (
  id                  uuid primary key default gen_random_uuid(),
  study_id            uuid not null references title_studies(id) on delete cascade,
  kind                cbr_document_kind not null,
  cbr_jurisdiction    text not null,        -- "CBR Santiago"
  status              cbr_document_status not null default 'pending',
  request_payload     jsonb not null default '{}'::jsonb,
                       -- {fna_foja:..,fna_numero:..,fna_anio:..,rut:..}
  external_request_id text,                  -- carátula CBR if any
  pdf_media_id        uuid references media_files(id),
  pdf_sha256          text,                  -- integrity
  fea_signature_valid boolean,               -- firma electrónica avanzada
  fea_signer_rut      text,
  fea_signed_at       timestamptz,
  cost_clp_paid       integer not null default 0,
  requested_at        timestamptz,
  delivered_at        timestamptz,
  parsed_at           timestamptz,
  failure_reason      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (study_id, kind, request_payload)   -- avoid duplicate pulls
);

create index idx_cbr_documents_status   on cbr_documents(status)
  where status in ('pending','requested','in_progress');
create index idx_cbr_documents_study    on cbr_documents(study_id);

-- ---------------------------------------------------------------------
-- title_chain_links
--   Eslabones (chain links) of >=10 year title chain.
--   Output of LLM tier-2 extraction + structural rules.
-- ---------------------------------------------------------------------

create table title_chain_links (
  id                  uuid primary key default gen_random_uuid(),
  study_id            uuid not null references title_studies(id) on delete cascade,
  source_document_id  uuid references cbr_documents(id) on delete set null,
  ordinal             integer not null,     -- 1 = oldest in window
  kind                title_chain_link_kind not null,
  fna_foja            integer,
  fna_numero          integer,
  fna_anio            smallint,
  marginal_to_link_id uuid references title_chain_links(id),
  acto_fecha          date,
  inscripcion_fecha   date,
  notario             text,
  comuna_notaria      text,
  from_party_json     jsonb not null default '{}'::jsonb,
                       -- [{rut, nombre, regimen_patrimonial, cuota}]
  to_party_json       jsonb not null default '{}'::jsonb,
  cabida_m2           numeric(14,2),
  deslindes_json      jsonb,
  citations_json      jsonb not null default '[]'::jsonb,
                       -- [{document_id, page, bbox}] for traceability
  llm_confidence      numeric(4,3),         -- 0.000..1.000
  human_verified_by   uuid references profiles(id),
  human_verified_at   timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (study_id, ordinal)
);

create index idx_chain_links_study  on title_chain_links(study_id, ordinal);
create index idx_chain_links_fna    on title_chain_links(fna_foja, fna_numero, fna_anio);

-- ---------------------------------------------------------------------
-- title_flags
--   Detected flags. Many per study.
-- ---------------------------------------------------------------------

create table title_flags (
  id                  uuid primary key default gen_random_uuid(),
  study_id            uuid not null references title_studies(id) on delete cascade,
  flag_code           text not null references title_flag_catalog(flag_code),
  severity            title_flag_severity not null,
  tier                title_flag_tier not null,
  detector            text not null,        -- 'rule_engine.v3','tier2_llm','tier3_llm'
  evidence_json       jsonb not null default '{}'::jsonb,
                       -- {citations:[{doc_id,page,quote,bbox}], facts:{...}}
  llm_confidence      numeric(4,3),
  cross_check_passed  boolean,
  human_overridden_by uuid references profiles(id),
  human_override_severity title_flag_severity,
  human_override_note text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_title_flags_study     on title_flags(study_id);
create index idx_title_flags_code      on title_flags(flag_code);
create index idx_title_flags_severity  on title_flags(study_id, severity);

-- ---------------------------------------------------------------------
-- external_data_pulls
--   Cache + audit of scrapes to public sources (SII/TGR/DGA/...).
-- ---------------------------------------------------------------------

create table external_data_pulls (
  id                  uuid primary key default gen_random_uuid(),
  study_id            uuid not null references title_studies(id) on delete cascade,
  source              external_data_source not null,
  endpoint_url        text not null,
  request_params      jsonb not null default '{}'::jsonb,
  response_payload    jsonb,                -- normalized
  raw_html_media_id   uuid references media_files(id),
  raw_pdf_media_id    uuid references media_files(id),
  http_status         integer,
  fetched_at          timestamptz not null default now(),
  ttl_expires_at      timestamptz,           -- e.g. TGR cert valid 1 month
  rpa_runner          text,                  -- 'cloud-run-job:cbr-santiago-v3'
  failure_reason      text
);

create index idx_external_pulls_study_source
  on external_data_pulls(study_id, source);
create index idx_external_pulls_ttl
  on external_data_pulls(ttl_expires_at)
  where ttl_expires_at is not null;

-- ---------------------------------------------------------------------
-- study_decisions
--   Final outcome (1 row per study at terminal state).
-- ---------------------------------------------------------------------

create table study_decisions (
  id                  uuid primary key default gen_random_uuid(),
  study_id            uuid not null unique references title_studies(id) on delete cascade,
  outcome             study_decision_outcome not null,
  decided_by          uuid not null references profiles(id),
  reviewed_by_lawyer  uuid references people(id),
  red_flags_count     integer not null default 0,
  yellow_flags_count  integer not null default 0,
  green_flags_count   integer not null default 0,
  recommendation_es   text not null,        -- shown to broker
  internal_notes      text,
  decided_at          timestamptz not null default now(),
  ai_summary_md       text,                 -- tier-3 LLM final write-up
  ai_summary_citations jsonb not null default '[]'::jsonb,
  disclaimer_accepted boolean not null default false
);

-- ---------------------------------------------------------------------
-- Triggers (set updated_at, refresh current_severity, audit)
-- ---------------------------------------------------------------------

create or replace function tg_title_studies_refresh_severity()
returns trigger language plpgsql as $$
begin
  update title_studies ts
     set current_severity = (
       select case
         when count(*) filter (where severity = 'red')    > 0 then 'red'
         when count(*) filter (where severity = 'yellow') > 0 then 'yellow'
         else 'green'
       end::title_flag_severity
       from title_flags
       where study_id = coalesce(new.study_id, old.study_id)
     ),
     updated_at = now()
   where ts.id = coalesce(new.study_id, old.study_id);
  return null;
end $$;

create trigger trg_title_flags_aiud
after insert or update or delete on title_flags
for each row execute function tg_title_studies_refresh_severity();

-- updated_at universal trigger (assumes set_updated_at function exists in PropOS)
create trigger trg_title_studies_updated_at  before update on title_studies
  for each row execute function set_updated_at();
create trigger trg_cbr_documents_updated_at  before update on cbr_documents
  for each row execute function set_updated_at();
create trigger trg_chain_links_updated_at    before update on title_chain_links
  for each row execute function set_updated_at();
create trigger trg_title_flags_updated_at    before update on title_flags
  for each row execute function set_updated_at();
create trigger trg_flag_catalog_updated_at   before update on title_flag_catalog
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- RLS placeholders (multi-tenant by organization_id).
-- Real policies pending tenant model decision; ship enabled-but-permissive
-- so we don't accidentally serve cross-org data once policies land.
-- ---------------------------------------------------------------------

alter table title_studies        enable row level security;
alter table cbr_documents        enable row level security;
alter table title_chain_links    enable row level security;
alter table title_flags          enable row level security;
alter table external_data_pulls  enable row level security;
alter table study_decisions      enable row level security;
alter table title_flag_catalog   enable row level security;

-- TODO: replace with org-scoped policy keyed off auth.jwt() ->> 'org_id'
create policy ts_select_same_org on title_studies for select
  using (organization_id::text = current_setting('app.org_id', true));
create policy ts_modify_same_org on title_studies for all
  using (organization_id::text = current_setting('app.org_id', true))
  with check (organization_id::text = current_setting('app.org_id', true));

-- catalog is global read-only
create policy fc_read_all on title_flag_catalog for select using (true);

-- ---------------------------------------------------------------------
-- View: v_title_study_summary (broker dashboard)
-- ---------------------------------------------------------------------

create or replace view v_title_study_summary as
select ts.id                          as study_id,
       ts.organization_id,
       ts.property_id,
       ts.status,
       ts.current_severity,
       ts.cbr_jurisdiction,
       ts.fna_foja, ts.fna_numero, ts.fna_anio,
       count(tf.*) filter (where tf.severity = 'red')    as red_count,
       count(tf.*) filter (where tf.severity = 'yellow') as yellow_count,
       count(tf.*) filter (where tf.severity = 'green')  as green_count,
       ts.cost_clp_estimated,
       ts.started_at,
       ts.completed_at
  from title_studies ts
  left join title_flags tf on tf.study_id = ts.id
 group by ts.id;

commit;

-- =====================================================================
-- Seeds: title_flag_catalog (38 rows, abbreviated; full set in
-- supabase/seed/title_flag_catalog.sql).
-- =====================================================================

-- insert into title_flag_catalog (flag_code, case_id, display_name_es,
--   description_es, remediation_es, default_severity, default_tier,
--   detection_automation, legal_sources, fix_time_days_min,
--   fix_time_days_max, fix_cost_clp_min, fix_cost_clp_max)
-- values
--   ('hipoteca_no_alzada','T01','Hipoteca vigente sin alzar', ...);

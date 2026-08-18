# API Conventions

PropOS REST API rules. Apply to every new endpoint. Everything is mounted under
`/api/v1` (`backend/app/main.py:179`). `docs/api.md` lists what exists today.

## Resource naming

- **Path = resource (noun, plural)**, never a verb. `POST /transcripts`, not `POST /transcribe`.
- **HTTP method = action**. `GET` list/read, `POST` create, `PATCH` partial update, `DELETE` remove.
- **`PUT` is not used anywhere in this API.** Don't introduce it — `PATCH` the fields you mean.
- **Plural** kebab-case for multi-word: `/internal-areas`, `/share-links`, `/user-phones`.
- **One feature dir per top-level resource**: `backend/app/features/<resource>/router.py`
  registers `APIRouter(prefix="/<resource>")`, and `main.py` mounts it under the
  versioned prefix.

## Sub-resources

- Nest only if the child cannot exist without the parent. `POST /workflows/{wf_id}/steps`, `PATCH /workflows/{wf_id}/steps/{step_id}`.
- If the child has independent identity (queryable, own lifecycle), promote it to
  its own top-level resource. `taggings`, `ads` and `share-links` are top-level
  even though they belong to tags/campaigns/documents — list-by-parent uses query
  params: `GET /ads?campaign_id=...`.

## Search & filters

- **Filters = query params** on list endpoints. `GET /contacts?q=juan&fuzzy=true&limit=10`.
- No dedicated `/search` route. The list endpoint is the search endpoint.
- Pagination is `limit`/`offset` with a per-router ceiling declared on the
  `Query(...)` (`le=500` on most list routes). The `DEFAULT_PAGE_SIZE` and
  `MAX_PAGE_SIZE` constants in `core/config/constants.py:4-5` are **dead — no
  router reads them**. Declare the bound on the route.

## State transitions

- **PATCH the resource**, don't `POST /resource/{id}/close`. Body: `{status: "CLOSED"}`.
- Side-effects (computed fields like `closed_at`) are server-side, not in the path.
- Action-style routes exist for operations that are not a simple field write:
  `POST /transactions/{id}/complete`, `POST /uploads/{id}/promote`,
  `POST /documents/{id}/versions/{vid}/make-current`,
  `POST /properties/{id}/generate-description`, `POST /users/{id}/impersonate`.
  Each of those runs a multi-step server routine. Use the pattern only when a
  `PATCH` would be a lie about what happens.

## Deletion

`DELETE` answers **204** with no body. Whether it is soft or hard depends on the
table: 21 of the 59 tables in `public` carry `deleted_at`, and only those get a
soft delete. `DELETE /properties/{id}` is a **hard** delete and is gated to
dev-admin for that reason (`properties/router.py:86`). If a new resource needs to
be recoverable, give it `deleted_at` in the migration — the API layer will not
save you. See `docs/disaster-recovery.md`.

## File uploads

- `POST /<resource>` with `multipart/form-data`. Don't put the verb in the path;
  the content type signals the intent.
- Live examples: `POST /agent/transcripts` (field `audio`),
  `POST /documents` (field `file`, optional `source_images`),
  `POST /properties/{id}/photos`, `POST /imports` (field `file`),
  `POST /p/{slug}/upload` (public portal).
- Browser-direct uploads to Supabase Storage (`avatars`, `media` buckets) do not
  go through the API at all; they run as `authenticated` under bucket policies.

## Streaming

SSE endpoints respond `text/event-stream` from a normal `POST /<sub-resource>`.
The agent returns its turn this way: `POST /agent/sessions/{id}/messages`
(`backend/app/features/agent/router.py:286`).

## Status codes

`200` read/update · `201` create · `204` delete (no body) · `400` client
validation · `401` bad or missing token · `403` failed role/scope/dev-admin gate
· `404` not found · `409` conflict · `503` dependency unavailable (LLM provider
down, `AI_PROCESSING_ENABLED=false`, internal-jobs secret unset).

Error bodies are FastAPI's default `{"detail": "..."}`. Messages in
`HTTPException(detail=...)` are **English**, like the rest of the code; only
user-facing UI strings are Spanish.

## Authorization

Declare gates as router- or route-level `dependencies=[...]`, never inline
checks in the handler:

```python
router = APIRouter(
    prefix="/interactions",
    tags=["interactions"],
    dependencies=[Depends(require_role("ADMIN", "AGENT")), Depends(require_scope("crm"))],
)
```

Remember that an empty `admin_scope` **passes** every scope gate — see
`docs/roles.md`. A scope declared only in the React router is a navigation
filter, not an access control.

## OpenAPI tags

One tag per resource. Multi-resource routers split tags per route group — the
agent router uses `agent-sessions`, `agent-messages`, `agent-transcripts`. Easier
to read in `/docs`, which is served in every environment except production
(`main.py:164-166`).

## Naming: `anita` is retired

The assistant was renamed **anita → agent** in migration
`20240601000011_rename_anita_to_agent.sql`. Routes, tables, tags, the Postgres
role and the `AGENT_*` env vars all use `agent`; a leftover `ANITA_*` env var
now **fails the boot** on purpose (`core/config/settings.py:96-109`). The product
name in the UI is "Propo". Never introduce `/anita/*` paths or `ANITA_*` keys.

## Versioning

Prefix `/api/v1`. Bump to `/api/v2` only on a breaking change. **No back-compat
shims** — change the code and update the callers in the same PR.

## What this replaces

| Anti-pattern | Use instead |
|---|---|
| `POST /transcribe` | `POST /agent/transcripts` (multipart) |
| `POST /chat` | `POST /agent/sessions/{id}/messages` |
| `POST /sessions/{id}/close` | `PATCH /agent/sessions/{id}` body `{status: "CLOSED"}` |
| `GET /contacts/search?q=` | `GET /contacts?q=...&fuzzy=true` |
| `PATCH /workflows/steps/{id}` | `PATCH /workflows/{wf}/steps/{id}` |
| `GET /tags/taggings` | `GET /taggings` (top-level) |
| `POST /campaigns/ads` | `POST /ads` (top-level, body has `campaign_id`) |
| `PUT /properties/{id}` | `PATCH /properties/{id}` |
| `/api/properties` | `/api/v1/properties` |

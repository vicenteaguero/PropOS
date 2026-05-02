# API Conventions

PropOS REST API rules. Apply to every new endpoint. Mounted under `/api/v1`.

## Resource naming

- **Path = resource (noun, plural)**, never a verb. `POST /transcripts`, not `POST /transcribe`.
- **HTTP method = action**. `GET` list/read, `POST` create, `PATCH` partial update, `PUT` full replace (avoid), `DELETE` soft-delete.
- **Plural** kebab-case for multi-word: `/internal-areas`, `/pending-proposals`.
- **One feature dir per top-level resource**: `/backend/app/features/<resource>/router.py` registers `APIRouter(prefix="/<resource>")`.

## Sub-resources

- Nest only if the child cannot exist without the parent. `POST /workflows/{wf_id}/steps`, `PATCH /workflows/{wf_id}/steps/{step_id}`.
- If the child has independent identity (queryable, lifecycle), promote it to its own top-level resource. `taggings`, `ads` are top-level even though they belong to tags/campaigns — list-by-parent uses query params: `GET /ads?campaign_id=...`.

## Search & filters

- **Filters = query params** on list endpoints. `GET /contacts?q=juan&fuzzy=true&limit=10`.
- No dedicated `/search` route. The list endpoint is the search endpoint.

## State transitions

- **PATCH the resource**, don't `POST /resource/{id}/close`. Body: `{status: "CLOSED"}`.
- Side-effects (computed fields like `closed_at`) are server-side, not in the path.
- Action-style routes only when the operation isn't a state change and doesn't fit CRUD (rare): `POST /properties/{id}/duplicate`. Use sparingly.

## File uploads

- `POST /<resource>` with `multipart/form-data`. Audio → `POST /anita/transcripts`. Image → `POST /media`.
- Don't put the verb in the path. The `multipart` content-type signals the intent.

## Streaming

- SSE endpoints respond `text/event-stream` from a normal `POST /<sub-resource>`. Anita: `POST /anita/sessions/{id}/messages` returns the assistant turn as SSE events.

## Status codes

- `200` read/update, `201` create, `204` delete (no body), `400` client validation, `401`/`403` auth, `404` not found, `409` conflict, `503` upstream error (e.g., LLM provider down).

## OpenAPI tags

- One tag per resource. Multi-resource routers (Anita) split tags per route group: `anita-sessions`, `anita-messages`, `anita-transcripts`. Easier to read in `/docs`.

## Versioning

- Prefix `/api/v1`. Bump to `/api/v2` only on breaking change. **No back-compat shims** — change code, update callers in same PR.

## What this replaces

| Anti-pattern | Use instead |
|---|---|
| `POST /transcribe` | `POST /transcripts` (multipart) |
| `POST /chat` | `POST /sessions/{id}/messages` |
| `POST /sessions/{id}/close` | `PATCH /sessions/{id}` body `{status: "CLOSED"}` |
| `GET /contacts/search?q=` | `GET /contacts?q=...&fuzzy=true` |
| `PATCH /workflows/steps/{id}` | `PATCH /workflows/{wf}/steps/{id}` |
| `GET /tags/taggings` | `GET /taggings` (top-level) |
| `POST /campaigns/ads` | `POST /ads` (top-level, body has `campaign_id`) |

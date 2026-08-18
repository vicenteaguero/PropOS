# PropOS Roles and Scopes

Authorization has **three independent gates**, all of them FastAPI dependencies
declared in `backend/app/core/dependencies.py`. A request must clear every gate
declared on its route — at the router level, at the route level, or both.

| Gate | Dependency | Reads | Failure |
|---|---|---|---|
| Role | `require_role(*roles)` (`:49-60`) | `profiles.role` | 403 `Insufficient permissions` |
| Scope | `require_scope(name)` (`:63-77`) | `profiles.admin_scope` | 403 `Insufficient permissions` |
| Dev admin | `require_dev_admin` (`:80-89`) | `role == "ADMIN"` **and** `is_dev_admin` | 403 `Dev admin required` |

Roles and scopes are **orthogonal**. Being ADMIN does not imply the `documents`
scope, and holding the `documents` scope does not make a BUYER able to read
documents. Both are evaluated, independently, on every request.

A fourth mechanism narrows *rows* rather than routes — see **Grant scoping**
below.

Every table here was derived by walking the built app's dependency tree, not
written from memory. `docs/api.md` carries the same information per endpoint.

---

## Axis 1 — role

`profiles.role` is a Postgres enum, `user_role`, with exactly five values:

```
ADMIN · AGENT · LANDOWNER · BUYER · CONTENT
```

There is **no VISITOR role**. Site visitors are contacts invited through
`visitor_invitations`; they register on a public slug URL
(`/api/v1/public/visitor-invitations/{slug}`) and never receive an account.

Of the 208 authenticated routes:

| Role | Routes reachable | Shape of the access |
|---|---|---|
| ADMIN | 208 | Everything. 8 of those also require dev-admin. |
| AGENT | 143 | Full CRM, productivity, money, marketing, taxonomy. No agent/analytics/imports/user admin. |
| CONTENT | 51 | Properties (except delete), documents/portals/share-links, publications, pending, push subscribe. |
| LANDOWNER | 14 | Read-only, and narrowed to granted properties. |
| BUYER | 8 | Own profile/tenant/memberships/grants and internal areas. Nothing else. |

### BUYER reaches exactly these 8 routes

```
GET   /api/v1/users/me
PATCH /api/v1/users/me/avatar
GET   /api/v1/tenants/me
GET   /api/v1/memberships/me
POST  /api/v1/memberships/activate
GET   /api/v1/grants/me
GET   /api/v1/internal-areas
GET   /api/v1/internal-areas/{area_id}
```

There is **no buyer-facing property browsing**, by design. `GET /properties` is
gated to ADMIN AGENT LANDOWNER CONTENT (`properties/router.py:35`), so a BUYER
gets 403. The plumbing for a buyer surface exists — `user_view` has a `buyer`
value, `property_grants.view` accepts it, `sharing/service.py:12` whitelists a
`buyer` audience — but no product screen does, so the role is deliberately left
out of `GRANT_SCOPED_ROLES` (`backend/app/features/grants/access.py:24-38`,
which spells out the exact change to make when the screen ships).

### LANDOWNER reaches these 14 routes

```
GET   /api/v1/users/me
PATCH /api/v1/users/me/avatar
GET   /api/v1/tenants/me
GET   /api/v1/memberships/me
POST  /api/v1/memberships/activate
GET   /api/v1/grants/me
GET   /api/v1/properties
GET   /api/v1/properties/{property_id}
GET   /api/v1/properties/{property_id}/photos
GET   /api/v1/internal-areas
GET   /api/v1/internal-areas/{area_id}
GET   /api/v1/documents
GET   /api/v1/documents/{document_id}/versions/{version_id}/download
GET   /api/v1/interactions
```

### Feature matrix

`—` in the scope column means the router declares no `require_scope`. Route
counts are per router; individual routes can be stricter than their router (e.g.
`POST /uf/refresh` is ADMIN-only inside an ADMIN AGENT router). `docs/api.md`
shows the effective gate per route.

| Feature router | Routes | Roles admitted | Scope |
|---|---|---|---|
| `grants` | 4 | ADMIN AGENT LANDOWNER CONTENT BUYER | — |
| `internal_areas` | 5 | ADMIN AGENT LANDOWNER CONTENT BUYER | — |
| `memberships` | 5 | ADMIN AGENT LANDOWNER CONTENT BUYER | — |
| `tenants` | 6 | ADMIN AGENT LANDOWNER CONTENT BUYER | — |
| `users` | 17 | ADMIN AGENT LANDOWNER CONTENT BUYER | — |
| `documents` | 24 | ADMIN AGENT LANDOWNER CONTENT | `documents` |
| `properties` | 10 | ADMIN AGENT LANDOWNER CONTENT | — |
| `interactions` | 5 | ADMIN AGENT LANDOWNER | `crm` |
| `notifications` | 3 | ADMIN AGENT CONTENT | — |
| `pending` | 5 | ADMIN AGENT CONTENT | `pendientes` |
| `publications` | 4 | ADMIN AGENT CONTENT | — |
| `ads` | 4 | ADMIN AGENT | — |
| `campaigns` | 6 | ADMIN AGENT | `crm` |
| `channels_api` | 6 | ADMIN AGENT | `inbox` |
| `compliance` | 3 | ADMIN AGENT | — |
| `contacts` | 7 | ADMIN AGENT | `crm` |
| `email_sync` | 5 | ADMIN AGENT | `email` |
| `events` | 6 | ADMIN AGENT | `productividad` |
| `notes` | 4 | ADMIN AGENT | `productividad` |
| `opportunities` | 6 | ADMIN AGENT | `crm` |
| `organizations` | 5 | ADMIN AGENT | `crm` |
| `places` | 5 | ADMIN AGENT | — |
| `projects` | 5 | ADMIN AGENT | — |
| `reminders` | 3 | ADMIN AGENT | `productividad` |
| `taggings` | 3 | ADMIN AGENT | — |
| `tags` | 4 | ADMIN AGENT | — |
| `tasks` | 5 | ADMIN AGENT | `productividad` |
| `transactions` | 6 | ADMIN AGENT | `finanzas` |
| `uf` | 2 | ADMIN AGENT | — |
| `workflows` | 4 | ADMIN AGENT | `workflows` |
| `agent` | 6 | ADMIN | `agent` |
| `analytics` | 10 | ADMIN | `analytics` |
| `channels.phones_api` | 3 | ADMIN | `phones` |
| `finance` | 2 | ADMIN | `finanzas` |
| `imports` | 3 | ADMIN | `datos` |
| `sharing` | 2 | ADMIN | — |
| `visitor_invitations` | 5 | ADMIN | — |

---

## Axis 2 — `admin_scope`

**An empty `admin_scope` means full access, not no access.** This is the single
most important thing about the scope model and the easiest to get backwards.

```python
# backend/app/core/dependencies.py:69-74
admin_scope: list[str] = current_user.get("admin_scope") or []
if admin_scope and scope not in admin_scope:
    raise HTTPException(403, ...)
```

```ts
// frontend/src/shared/components/protected-route/protected-route.tsx:56-61
const scope = user.adminScope ?? [];
if (scope.length > 0 && !scope.includes(requiredScope)) return <Forbidden />;
```

`profiles.admin_scope` is `TEXT[] NOT NULL DEFAULT '{}'`
(`supabase/migrations/20240601000017_profiles_admin_scope.sql:10`), so **every
user is unscoped by default and passes every scope gate**. The column exists to
build "admin-lite" users: give someone `{crm, productividad}` and they lose
everything else. Writing a scope list is a *restriction*, never a grant.

The per-tenant source of truth is `tenant_memberships.admin_scope`
(`20240601000022_tenant_memberships.sql:19`); `profiles.admin_scope` is a
denormalized snapshot of the active membership, refreshed by the
`activate_tenant` RPC.

Scope gates are **not** conditioned on `role == "ADMIN"`: `require_scope` reads
`admin_scope` for whoever is calling. In practice non-admins carry an empty
array and pass, but writing a scope list onto an AGENT or a LANDOWNER will start
returning 403 on the scoped routers.

### The twelve scope tokens

Each is enforced on both sides — `require_scope` in the router and
`requiredScope` in `frontend/src/app/router.tsx`.

| Scope | API surface | UI surface |
|---|---|---|
| `crm` | contacts · organizations · interactions · opportunities · campaigns | `/admin/bandeja` `/personas` `/interacciones` `/oportunidades` |
| `productividad` | tasks · events · notes · reminders | `/admin/tareas` `/calendario` `/notas` |
| `finanzas` | transactions · finance | `/admin/finanzas` |
| `documents` | documents · portals · share-links · uploads | `/admin/documents*` |
| `pendientes` | pending | `/admin/pendientes` |
| `inbox` | client-chat | `/admin/client-inbox` |
| `email` | email threads | `/admin/correos` |
| `workflows` | workflows | `/admin/workflows` |
| `analytics` | analytics | `/admin/analytics*` |
| `agent` | agent sessions/messages/transcripts | `/admin/agent` |
| `phones` | user-phones | `/admin/phones` |
| `datos` | imports | `/admin/datos/importar` |

`backend/tests/test_router_scopes.py` pins this map so a new router cannot ship
without its scope gate.

---

## Axis 3 — dev admin

`is_dev_admin` lives on `tenant_memberships` and is merged into the user dict by
`get_user_profile` (`backend/app/core/supabase/auth.py:16-51`). It gates the
8 operations that are destructive or that bypass identity:

```
DELETE /api/v1/users/{user_id}
POST   /api/v1/users/{user_id}/set-password
POST   /api/v1/users/{user_id}/disable
POST   /api/v1/users/{user_id}/enable
POST   /api/v1/users/{user_id}/impersonate
POST   /api/v1/admin/tenants
DELETE /api/v1/admin/tenants/{tenant_id}
DELETE /api/v1/properties/{property_id}
```

Note the asymmetry in `properties`: create and update are ADMIN AGENT CONTENT,
delete is dev-admin only (`properties/router.py:86`). Ordinary deletion of a
property is not an API operation.

---

## Grant scoping (row-level, not route-level)

LANDOWNER is the one role that lives outside the brokerage: it has no
tenant-wide reach, only the properties an admin explicitly granted it through
`property_grants`. That narrowing is **not** a dependency — it happens inside
the handler, via `backend/app/features/grants/access.py`:

- `is_grant_scoped(user)` — true for the roles in `GRANT_SCOPED_ROLES`, today
  `("LANDOWNER",)`.
- `assert_property_granted(user, tenant_id, property_id)` — 403 unless the
  caller holds a grant on that property. Staff pass through untouched.

Applied at `documents/router.py:119` (list) and `interactions/router.py:49-55`
(list). On top of the grant check, a landowner reading interactions sees only
the rows the broker shared with the `owner` audience — `audience_caps`,
validated against `ALLOWED_AUDIENCES` in `sharing/service.py:12` and projected
by `shared_with_owner` (`interactions/schemas.py:110`).

Because those two endpoints require a `property_id` to narrow against, a
landowner cannot list documents or interactions tenant-wide.

---

## The `view` field (UI only)

`tenant_memberships.view` is a `user_view` enum with six values — `admin`,
`admin-dev`, `agent`, `owner`, `buyer`, `content`
(`20240601000022_tenant_memberships.sql:13`). It decides which React tree a user
lands in, and it is **not an authorization gate**: no backend dependency reads
it. Today it guards exactly one route tree, `/owner`
(`frontend/src/app/router.tsx:449`, `requiredView={["owner", "admin-dev"]}`).

The frontend mounts role trees for `ADMIN`, `AGENT`, `BUYER` and `CONTENT`
(`router.tsx:192`) plus that view-based `/owner` tree. `BUYER` and `CONTENT` get
an `EmptyDashboard` index and none of the feature sub-routes.

---

## Known gaps

- **CONTENT has permissions but no product.** 51 reachable routes, an
  empty dashboard.
- **BUYER is effectively unused.** The role exists in the enum, in `user_view`,
  in `audience_caps` and in the frontend route table, and reaches only
  self-service endpoints.
- **The property reads are not grant-narrowed.** `GET /properties`,
  `GET /properties/{id}` and `GET /properties/{id}/photos` admit LANDOWNER on
  the role gate alone; none of them calls `assert_property_granted`, and
  `PropertyService.list_properties` filters by `tenant_id` only. So a landowner
  sees the whole tenant catalogue there, while the same role is correctly
  narrowed on `documents` and `interactions`.

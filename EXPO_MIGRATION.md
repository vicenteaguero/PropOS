# PropOS on Expo: migration decision document

Status: **decided, not started**. Written 2026-09-23 against `dev` @ `8b2eb23d`. Revised the same
day: one universal codebase (iOS, Android, web) instead of a native app beside the Vite app.
Audience: the owner (to approve) and Claude Code (to execute unattended).
Research behind every line, with file:line evidence: `docs/research/expo-migration/` (gitignored,
this machine only): `00-stage1`, `10-routing-auth`, `20-ui-styling`, `30-platform-apis`,
`40-screens-libs`, `50-backend-infra`, `60-native-capabilities`. The research was written for the
two-app plan; where it disagrees with this document, this document wins.

---

## 1. Verdict

- **One codebase**: a universal Expo app (`apps/app`) that ships to iOS, Android and the web.
  It replaces the Vite app (`apps/web`) once it reaches parity; until then Vite keeps serving
  production and nothing changes for users.
- **Two presentations, one codebase.** The app (native) is built for speed, priorities and
  device features (widgets, GPS, camera, push actions); the web is built for density and precise
  actions. Screens may look and behave differently; logic, data, gates, kit and routes are shared.
- Order: the broker's phone screens first (native v1), then desktop layouts and the screens that
  today exist only on the web, then cutover (Vercel serves the Expo web export, Vite is deleted).
- Same repo, pnpm + turbo monorepo: `apps/web` (today's `frontend/`, legacy until cutover),
  `apps/app` (new), `packages/{tokens,domain,api,query}` (logic both apps use during the
  transition).
- The UI is **rewritten**, not ported: 75% of the frontend is `.tsx` built on DOM, Tailwind and
  Radix. What moves unchanged: about 72% of the non-UI TypeScript (endpoints, types, query hooks,
  date rules, labels, feature catalog, palette maths) and 37 of the 46 test files. After cutover,
  every feature is built once for all three platforms.
- Components with no native equivalent (charts, PDF viewer on web, map on web, drag kanban,
  command palette) live in `.web.tsx` files that keep today's web libraries.
- About 3,100 lines of Safari workarounds and about 2,700 lines of hand-written document scanner
  are **deleted**, not ported.
- Backend: no auth/CORS change. It needs native push (device tokens + Expo sender), a minimum
  supported build endpoint, one transcription fix, and an additive-only API rule from now on.
- Effort, in agent time: about **11 to 14 unattended runs of ~10 hours** (section 11.2), plus the
  owner's review between runs. Apple and Google enrolment are outside this estimate: they gate only
  iOS device builds and store submission, never the code.

---

## 2. Decisions

Each row is final unless the owner overrides it. "Why" is the deciding reason, nothing more.

### 2.1 Product and scope

| ID | Decision | Why |
|---|---|---|
| D1 | One universal Expo app for iOS, Android and web. The Vite app stays in production, untouched except for P1 fixes, until the cutover gate (P19) passes. | Two UIs would make every future feature cost double. |
| D2 | Every role is served by the same app. Build order: ADMIN and AGENT phone screens (P7 to P11), then the remaining screens and roles (P17). On native, before P17, BUYER, CONTENT and LANDOWNER see `sin-acceso` with a link to the web. | The only live users are ADMIN; the rest arrives with web parity. |
| D3 | Scope by phase: section 4. Nothing is "web-only forever" at the code level; some screens are hidden from the native navigation (4.3). | One codebase means one route tree. |
| D4 | **Two presentations over one logic layer.** *Compact* (always on native, and on web below 768 px): speed and priorities, one primary action per screen, fewer fields up front (progressive disclosure), quick capture, native-only features. *Wide* (web from 768 px): density and precision, today's web design (tables, master-detail, hover actions, kanban, shortcuts). A screen is one file when both presentations are the same component; it splits into `x.compact.tsx` + `x.wide.tsx` (chosen by `usePresentation()`) as soon as they differ. Hooks, gates, routes, forms logic and kit are never split. | The app and the web serve different moments of the broker's work; sharing everything below the screen keeps one codebase. |
| D4a | **Verifiable anchors.** Wide must reach content and action parity with the Vite app at 1280 px (every column, filter and action present). Compact starts from today's mobile web layout (already phone-first) and applies D4's compact principles; every deliberate difference (field hidden, action moved, order changed) is one line in `docs/research/expo-migration/COMPACT-DIFFS.md` for the owner to review. The information architecture (sections, tabs, routes) stays the same on both; IA changes come after cutover. | An unattended run needs something to compare against; the owner decides on the differences, not the run. |
| D4b | **Native-only features never have a web fallback screen.** Widgets, GPS/geofencing, document scanner, share intent, quick actions, biometric unlock, push actions, post-call prompt, background upload: absent on web (no button, no placeholder). Web gets its own exclusives the same way: command palette, kanban drag, bulk actions, CSV import, analytics charts. | Each surface shows what it is good at. |
| D5 | Native: phone only, portrait, `supportsTablet: false`. Web: designed for desktop (wide); below 768 px it serves the compact presentation without native-only features. | Brokers use the app on the phone; the web is the desk. |
| D6 | Spanish UI strings copied verbatim from the web (or imported from `@propos/domain` labels). New copy only for native-only surfaces. | One voice; no drift. |

### 2.2 Platform and stack

| ID | Decision | Why |
|---|---|---|
| D7 | Expo SDK: the latest **stable** SDK on the day P4 starts. SDK 58 (beta since 2026-09-15) if stable, else 57. Never a beta. Upgrade only between phases. | 58 adds Android widgets and a first-party document scanner; betas break unattended runs. |
| D8 | New Architecture, Hermes, expo-router, Continuous Native Generation (`android/` and `ios/` gitignored). Web output `single` (SPA): the app is authenticated, SEO is irrelevant. | Expo defaults; SmartPAES precedent; the Vercel rewrite model stays the same. |
| D9 | Dev client from day one (`expo-dev-client`). No Expo Go. | Push, scanner, keyboard controller and background audio need native code. |
| D10 | Styling: React Native `StyleSheet` + typed tokens from `@propos/tokens` on every platform, including `.web.tsx`. **No Tailwind, NativeWind or Uniwind.** Responsive through `useBreakpoint()` (from `useWindowDimensions`); hover through `Pressable` `hovered` state on web. | Every element is rewritten anyway; react-native-web compiles StyleSheet to atomic CSS; one styling idiom. |
| D11 | Theme engine ported as a pure `resolveTheme({ mode, palette \| tenantAccent }) -> Theme` in `@propos/tokens`. OKLCH precomputed to hex; every `color-mix` becomes a JS `mix()` computed once per theme. | React Native parses neither `oklch()` nor `color-mix`. |
| D12 | Theme preference `system \| light \| dark`, default `dark`. Server palette (`profiles.preferences.palette`) wins over the local cache; the cache paints first. | Keeps the PropOS default and the contract of `theme-controller.tsx:62-67`. |
| D13 | **Platform files rule**: every module that touches a platform API lives in `src/shared/platform/` as `x.ts` (native) + `x.web.ts` (web), same exported signature. Screens and features never branch on `Platform.OS` for capabilities. | Keeps features universal; one place per capability. |
| D14 | Key/value storage: native `expo-sqlite/kv-store` (sync reads for boot values: theme, palette, tenant accent, active tenant, dev schema); web `localStorage`. No MMKV, no AsyncStorage package. | First-party, sync API for the first frame; expo-sqlite on web needs WASM and cross-origin isolation headers. |
| D15 | Supabase session: native uses a "large secure store" adapter (AES key in `expo-secure-store`, ciphertext in kv-store); web keeps supabase-js default storage. `autoRefreshToken: true`, refresh started and stopped on `AppState` (native). `detectSessionInUrl`: `false` on native, `true` on web (auth landings). **One** Supabase client per app. | SecureStore alone cannot hold a session (~2 KB cap); refresh-token rotation with a 10 s reuse window punishes two clients. |
| D16 | TanStack Query persisted (native kv-store, web idb-keyval as today), maxAge 24 h, `buster` = update id or build id, namespaced by `userId:tenantId`, wiped on sign-out. `focusManager` on `AppState`, `onlineManager` on `expo-network`. | Instant cold start without cross-tenant leaks or stale shapes after an update. |
| D17 | Mutations are online-only. Offline = read-only cached data plus one offline banner. | Audit headers, idempotency and conflicts are not designed for replay. |
| D18 | Libraries: section 7.3. Always installed with `npx expo install`. | Version skew is the top cause of native build failures. |
| D19 | Web bundle: every route lazy (expo-router async routes on web if stable, else `React.lazy` per heavy `.web.tsx`); heavy libraries (recharts, react-pdf, maplibre-gl, dnd-kit, pdf-lib) imported only inside lazily loaded files. Budget: initial web JS no larger than today's Vite entry chunk + 25%, measured in P18. | Today's web invested in chunking (`vite.config.ts` comments); react-native-web must not undo it. |

### 2.3 Navigation and auth

| ID | Decision | Why |
|---|---|---|
| D20 | Routes drop the `/:role` prefix on every platform. Path tails stay the web Spanish paths (`/personas/[id]`, `/negocios/[id]`, `/propiedades/[id]`, `/documentos/[id]`). One pure `toAppPath(url)` in `@propos/domain` converts any old URL: strips the role, applies the legacy table from `app/legacy-routes.ts`, maps `?tab=` and English detail paths. Native: `+native-intent.tsx`. Web: redirect routes `admin/[...rest]`, `agent/[...rest]`, `buyer/[...rest]`, `content/[...rest]`, `owner/[...rest]` plus the legacy paths, so every bookmark and old push still lands. | Role is session state; old links never break (CLAUDE.md: never delete a legacy redirect). |
| D21 | New push payloads carry role-less paths. `toAppPath` keeps accepting the old ones forever. Telemetry re-adds the role prefix before `canonicalPath` so `usage_events` keys stay continuous. | No break in history or in deep links. |
| D22 | Shell follows the presentation (D4): **compact** = floating tab bar: **Inicio, Clientes, Propo (centre button, opens `/propo` as a full-screen modal), Agenda, Documentos**; Más opens from the avatar button in the header of every tab root and carries the pending dot. AGENT (no Propo) gets four slots. **Wide** (web >= 1024 px) = sidebar + header with workspace switcher, command palette (`.web.tsx`, cmdk), UF chip, theme, avatar menu, today's `buildGroups` tree. 768 to 1023 = sidebar collapsed to icons. | Same nav model (`@propos/domain`) drives both; matches today's `useShellMode`. |
| D23 | Section tabs (`?tab=`) become a `SegmentedTabs` control on a local `tab` search param, reading the `SectionTab` data (ids, aliases, `feature`, `scope`) from `@propos/domain`. | One gating structure. |
| D24 | Create and edit forms: bottom sheet on phone, centred dialog on wide (`ResponsiveSheet` contract kept). Quick actions, push and links open the list with `?nuevo=1`, like web `use-open-on-param`. | 33 call sites keep their logic. |
| D25 | Guards: `Stack.Protected` at the root for session, `must_change_password` and role; a per-screen `<ScreenGate scope feature devAdmin>` for scope and feature state (hidden = redirect home, locked = locked screen, wip = banner). | `Stack.Protected` does not stop a programmatic push to a gated screen. |
| D26 | Auth: password login and forced password change on all platforms. Invite, recovery and forgot-password landings are web routes of the same app (`/auth/setup`, `/auth/recovery`, `/forgot-password`), unchanged URLs, so Supabase emails and the redirect allowlist need no change. On native, "¿Olvidaste tu contraseña?" opens `${EXPO_PUBLIC_WEB_URL}/forgot-password` in `expo-web-browser`. No PKCE. | Zero Supabase config change. |
| D27 | Public pages (`/r/:slug`, `/p/:slug`, `/invitacion/:slug`, `/privacidad`, `/derechos`) are web routes of the same app, outside the auth guard, never linked from native navigation. | One codebase, same URLs as today. |
| D28 | Universal links: v1.1, authenticated paths only, **never** `/r/*`, `/p/*`, `/invitacion/*`, `/auth/*`, `/forgot-password`. | External recipients do not have the app. |

### 2.4 Backend, push, release

| ID | Decision | Why |
|---|---|---|
| D29 | Native push via `expo-notifications` + Expo Push Service with an access token ("enhanced push security"). Web push (VAPID) stays for the web target, moved into `push.web.ts`. New user-scoped tables `push_devices` and `push_deliveries` (9.2); one dispatcher fans out to both transports. | One API for APNs + FCM; fixes the one-workspace-only gap. |
| D30 | Fix push defects v0.2 N1 (server-derived `data.url`) and N2 (honest per-device delivery, real retries) **before** adding the Expo transport. | The native sender must build on the corrected contract. |
| D31 | `GET /v1/app/config` returns `min_supported_build` per platform and `store_url`. Native below it shows a blocking "Actualiza PropOS" screen. Web keeps its own version gate (`version.json` written after `expo export`, same logic as `core/version/*`, in `update.web.ts`). | Binaries lag; web tabs go stale. |
| D32 | **API changes are additive-only from the day the first binary ships.** A field or route is removed only after `min_supported_build` passes the last client that used it. | Installed binaries lag by weeks. |
| D33 | EAS Update with `runtimeVersion: { policy: "fingerprint" }`. Channels: `production` = `main` = `propos-api` + `public`; `preview` = `dev` = `propos-api-dev` + `propos_test`; `development` = dev client. Preview OTA publishes automatically on push to `dev`; production OTA is manual (`make mobile-update-prod`). Web deploys stay Vercel on push, as today. | Fingerprint prevents incompatible OTAs; one publish path per environment. |
| D34 | `EXPO_PUBLIC_*` values: EAS environment variables for native (never in `eas.json`); Vercel project env vars for web (same model as `VITE_*` today). Every `eas update` passes `--environment`. | Values are baked at build or publish time. |
| D35 | Identity: owner `prudentia`, slug `propos`, bundle/package `cl.prudentia.propos` (production) and `cl.prudentia.propos.dev` (development + preview), scheme `propos` / `propos-dev`, names "PropOS" / "PropOS Dev". `app.config.ts` keyed on `APP_VARIANT`. | Both installable side by side. |
| D36 | Uploads: `FormData` with `{ uri, name, type }` parts on native, `File` on web, through one `toUploadPart()`; one file per request; images compressed first. v1.1: signed upload URLs straight to Storage. | Cloud Run caps request bodies at 32 MiB while documents allow 50 MB. |
| D37 | Transcription: backend forwards the real filename and MIME to Groq (today hardcoded `audio/webm`). Native records m4a (AAC). | Ships first; also fixes iPhone web recordings. |
| D38 | Share and portal links built from `EXPO_PUBLIC_WEB_URL`, not the API URL. | `/r/:slug` and `/p/:slug` are web pages. |

### 2.5 Repo and tests

| ID | Decision | Why |
|---|---|---|
| D39 | Monorepo in this repo: pnpm (`packageManager: pnpm@12.4.2`, as SmartPAES), `nodeLinker: hoisted`, turbo. Packages are TS source (`main: ./src/index.ts`), no build step. They stay after cutover. | Both apps consume the logic during the transition; tests live with the logic. |
| D40 | Move `frontend/` to `apps/web` as its own change with **no behaviour change**, green CI, before any Expo code. `apps/web` is deleted in P19. | Isolates the risky infra change. |
| D41 | CI job names stay unchanged until cutover. The new app job is **not** in `REQUIRED_CHECKS` (`scripts/check_ci_status.py`) until P19 makes it the frontend job. | The app must not block a backend deploy through `ci-gate` while it is unfinished. |
| D42 | Tests: packages keep vitest; the app uses `jest-expo` + React Native Testing Library; web end-to-end uses Playwright against `expo start --web`; native end-to-end uses Maestro on the local emulator (later EAS Workflows). | 37 pure tests move with zero rewrite; each target tested by its natural tool. |
| D43 | Forms stay hand-rolled `useState`. No react-hook-form. zod only at API boundaries if it earns its place. | What the web does today. |

---

## 3. Owner input

### 3.1 Before Run 1 (blocks only P6 and later)

| # | Item | Default if silent |
|---|---|---|
| O1 | A **test account** for unattended runs: `propos-mobile-test@propos.dev`, ADMIN, member of the `PropOS Demo` tenant only (`dededede-0000-4000-8000-000000000001`), `must_change_password = false`, not dev admin. Creating it writes to production auth, so the owner runs the script P0 writes. Password in `DEV_USERS.local.md` (gitignored). Also the store reviewer account. | Run 1 stops after P5 and logs it. |
| O2 | Unattended runs may write through the app **only inside `PropOS Demo`**. | Assumed yes. |

### 3.2 Before the first store submission

| # | Item | Default |
|---|---|---|
| O3 | Wording of the AI consent screen (audio and text go to Groq). Ley 21.719, Apple 5.1.2(i). | Draft written in P14; owner approves. |
| O4 | `pin_offline` ("disponible sin conexión"): implement or remove. Today it only sets a flag. | Hidden on native, web behaviour unchanged. |
| O5 | Store name, icon, screenshots, support email, privacy answers. | "PropOS", current icon. |

### 3.3 Human-only steps (outside the effort estimate)

None of these block code. They gate iOS device builds, push credentials, store submission and
the cutover.

1. Apple Developer Program, organisation enrolment for Prudentia (D-U-N-S, USD 99/yr).
2. Google Play Console, organisation account (USD 25, D-U-N-S; organisation accounts skip the 12-tester rule).
3. App Store Connect app records; App Store Connect API key for EAS Submit.
4. Firebase project for FCM: both Android packages; `google-services.json` as an EAS file env var; FCM v1 service account uploaded to EAS.
5. Expo: `prudentia` org access, a robot `EXPO_TOKEN` for GitHub Actions, a push access token (`EXPO_ACCESS_TOKEN`) in `.env` for `make deploy-secrets-sync`.
6. iPhone: `eas device:create`, then Developer Mode on.
7. Vercel: Root Directory of `prop-os-edge` and `prop-os` to `apps/web` when the monorepo move merges; a third project `prop-os-next` on `apps/app` (web export) for parity testing from P16; at cutover, `prop-os-edge` and `prop-os` to `apps/app`.
8. Apply the new migrations (`make migrate`): migrations reach production from any branch, so unattended runs write them but never apply them.

---

## 4. Scope

Sizes S, M, L are relative weight only; agent time per phase is in 11.2.

### 4.1 Phone screens, native v1 (P6 to P13)

| Area | Screens (route) | Web source | Notes | Size |
|---|---|---|---|---|
| Auth | `login`, `cambiar-clave` | `features/auth` | forgot-password opens the web on native | S |
| Shell (phone) | `(tabs)/_layout`, `mas` | `layouts/*`, `nav-items.ts` | D22; Más = nav list, workspace switcher, theme, palette, sign out, build stamp | M |
| Inicio | `(tabs)/index` | `features/home` | tiles gated by scope + feature | M |
| Clientes > Conversaciones | `(tabs)/clientes?tab=conversaciones`, `conversaciones/[hilo]` | `features/attention`, `features/client-chat` | realtime; refetch on `AppState` active; keyboard-sticky composer | L |
| Clientes > Negocios | `(tabs)/clientes?tab=negocios`, `negocios/[id]` | `features/opportunities`, `features/deals` | stage list + long-press "Mover a etapa" sheet (drag kanban is the wide web layout, P16) | M |
| Personas | `personas/index`, `personas/[id]` | `features/contacts`, `features/interactions` | `tel:`, `wa.me`, `mailto:` via `Linking` | M |
| Propiedades | `propiedades/index`, `propiedades/[id]` | `features/admin-properties` | list, detail, gallery + upload, form; map view v1.1 | L |
| Agenda | `(tabs)/agenda?tab=calendario\|tareas\|notas` | `features/calendar`, `tasks`, `notes` | month and day/week grids over lifted date logic; voice notes | L |
| Propo | `propo` (full-screen modal) | `features/agent` | `expo/fetch` streaming; expo-audio with metering; proposal cards | L |
| Pendientes | `pendientes` | `features/pending` | | M |
| Documentos | `(tabs)/documentos?tab=documentos`, `documentos/[id]` | `features/documents` | list, viewer, upload (camera / photos / files), native scanner, share link + QR, file cache | L |
| UF | chip + sheet | `features/uf` | | S |
| Cuenta | `ajustes/index` | `features/settings` subset | profile, avatar, theme, palette, push, biometric, delete account, sign out; every role | M |
| Dev | `ajustes/funcionalidades`, `ajustes/desarrollo` | settings | switchboard already phone-first | S |
| Native extras | quick actions, post-call prompt, biometric unlock, haptics | new | section 5 | M |

### 4.2 Wide presentation and web parity (P16 to P18)

Every P7 to P11 screen gets its wide presentation in P16 (today's web design); the table below is
what exists only on the web today.

| Area | Route (unchanged URL minus role) | Web source | Heavy part |
|---|---|---|---|
| Wide shell | layout for >= 768 px | `layouts/app-layout.tsx`, `app-sidebar.tsx` | command palette `.web.tsx` (cmdk) |
| Wide layouts of phone screens | same routes | `MasterDetail`, `ResponsiveTable` | master-detail, tables, hover actions |
| Negocios kanban | `clientes?tab=negocios` wide | `opportunity-kanban.tsx` | `.web.tsx` with `@dnd-kit` |
| Propiedades map | `propiedades?vista=mapa` | `property-map*.tsx` | `.web.tsx` with maplibre-gl; native with `@maplibre/maplibre-react-native` v11 |
| Documentos: editor, versions, Enlaces, portal admin | `documentos/[id]/editar`, `documentos?tab=enlaces` | `document-editor*`, `version-history-drawer`, `portal-admin-page` | pdf-lib, `.web.tsx` react-pdf; sortable pages via `react-native-reanimated-dnd` |
| Finanzas | `finanzas?tab=movimientos\|analitica\|costo-propo\|uso` | `features/finance`, `features/analytics` | recharts in `.web.tsx`; native shows movements, charts behind 4.3 rule |
| Timeline | `timeline/[table]/[id]` | `entity-timeline-page` | |
| Email views | inside Personas | `features/email` | |
| Admin | `usuarios`, `usuarios/[id]`, `telefonos`, `tenants`, `visitantes`, `datos/importar`, `ajustes/clientes`, `ajustes/propo`, `workflows` | `admin-*`, `data-admin`, `settings`, `workflows` | CSV file input `.web.tsx` |
| Other roles | client inbox (BUYER, CONTENT), owner portal (`/owner`) | `client-chat`, `owner` | |
| Public and auth landings | `/r/[slug]`, `/p/[slug]`, `/invitacion/[slug]`, `/privacidad`, `/derechos`, `/auth/setup`, `/auth/recovery`, `/forgot-password` | `documents/pages/*public*`, `visitor-registration`, `legal`, `auth` | id-scan capture on web: file input with `capture` |

The web URLs are kept in English where they are English today (`/admin/users`, `/admin/phones`)
through D20 redirects; new canonical paths are Spanish (routes follow the UI rule).

### 4.3 Hidden from native navigation

Rendered by the same code, reachable on native only by link, not listed in Más: data import,
tenants, phones, catalogs, Propo policies, workflows, analytics charts, usage and Propo cost, the
document editor. On native those screens show their content where it works on a phone; a chart or
editor that has only a `.web.tsx` implementation renders a card "Disponible en la web" on native
(file `x.native.tsx`). Public pages and auth landings are web-only routes.

---

## 5. What the app makes possible

Value 1 to 5 for a broker. Phase: v1, v1.1, later, never.

| Capability | Value | Phase | Attaches to |
|---|---|---|---|
| Reliable push on iOS without "Add to Home Screen": action buttons (Hecha, Posponer 1 h), badges, local scheduled reminders | 5 | v1 | reminders, tasks, Propo proposals |
| Native document scanner (VisionKit / ML Kit) | 5 | v1 | Documentos |
| Share **into** PropOS from WhatsApp, Files, Photos, a portal listing URL (impossible on iOS PWA) | 5 | v1.1 | uploads review, Propo intake, property draft |
| 120 Hz lists, native keyboard, gestures, no viewport hacks | 5 | v1 | everything |
| One codebase: each feature built once for iOS, Android and web | 5 | cutover | everything |
| Background photo uploads | 4 | v1.1 | property photos |
| Propo voice notes that survive screen lock, hold-to-talk with haptics | 4 | v1 | Propo, notes |
| Tap-to-call, then "¿Cómo fue la llamada con X?" on return | 4 | v1 | Personas, interactions |
| Biometric unlock | 4 | v1 | auth |
| Universal links from WhatsApp and email | 4 | v1.1 | links, push |
| Home screen widget: today's agenda and next visit | 4 | v1.1 | calendar `lib/upcoming.ts` |
| Contacts: pick from phone; save persona to phone | 4 | v1.1 | Personas |
| Quick actions: Nota de voz, Escanear, Nueva tarea, Hoy | 3 | v1 | Propo, Documentos, Agenda |
| Files: pick from Files/Drive; export a real PDF to WhatsApp | 3 | v1 | Documentos |
| Native HEIC and compression; geotagged photos | 3 | v1 / v1.1 | Propiedades |
| Cédula QR scan to prefill RUT | 3 | v1.1 | visitor registration |
| Device calendar one-way sync | 3 | v1.1 | Agenda |
| Offline read cache | 3 | v1 | all lists |
| Offline outbox for notes and interactions | 3 | later | |
| "Llegaste a la visita" (foreground check, geofencing only if needed) | 3 | later | calendar visits |
| Store presence for owners and B2C clients | 3 | later | owner portal |
| Siri / App Intents, Live Activities, caller ID extension | 2 | later | |
| Android call log, finger signature, NFC, Files app provider, in-app review | 1 | never (for now) | |

### 5.1 What gets worse

| Loss | Mitigation |
|---|---|
| Native changes need a store build and review | JS ships by EAS Update; batch native changes |
| Version skew: old binaries in the field | D31, D32 |
| Desktop web polish (dense tables, hover, text selection, shortcuts) costs more on react-native-web | wide presentation files and `.web.tsx` for dense pieces; P16 compares every screen with the Vite app at 1280 px |
| Web bundle may grow (react-native-web runtime) | D19 budget, measured before cutover |
| A native screen is not a shareable URL | universal links (v1.1) |
| iOS cannot be built on `workstation` (Linux) | EAS cloud builds, or the MacBook |
| No selling seats inside the app (IAP rules) | billing stays outside |

---

## 6. Pre-existing defects to fix first (P1)

Each is its own commit on the Vite app or the backend, independent of Expo.

| # | Defect | Where | Fix |
|---|---|---|---|
| B1 | Five dependencies never imported | `frontend/package.json`: `mammoth`, `jscanify`, `react-hook-form`, `@hookform/resolvers`, `zod` | remove |
| B2 | Transcription sends every recording as `audio/webm` | `features/agent/api/agent-api.ts:32`, `backend/app/features/agent/transcribe.py:221,249`, `router.py:317` | D37 |
| B3 | Warm-up fetches a relative `/health` | `frontend/src/core/query/warmup.tsx:46` | absolute URL |
| B4 | Finanzas dev tabs check `view === "admin-dev"`, everything else `isDevAdmin` | `features/sections/pages/finance-section-page.tsx:23` | `isDevAdmin` |
| B5 | `propiedades/:id` and `timeline/:table/:id` have no feature/scope gate | `frontend/src/app/router.tsx:311,388` | same gates as their lists |
| B6 | Push opens `/` for every reminder; SENT with zero devices; no real retry | v0.2 N1, N2 | D30 |
| B7 | Share/portal public URLs built from the API URL | `frontend/src/shared/api/http.ts:98` | verify; build from the web URL |
| B8 | Web cache hygiene on sign-out | `docs/research/expo-migration/30-platform-apis.md` F2 (gitignored) | fix on Vite; the app is designed to avoid it (8.4) |
| B9 | CLAUDE.md drift: Clientes has two tabs (doc says four); 46 test files (doc says one) | `CLAUDE.md` | fix in P2 |
| B10 | Token drift: `palette.ts:329` light card `#ffffff` vs `index.css:323` `#fbfaf8`; `theme.ts:29` backgrounds vs real `#0c0e12`/`#fbfaf8` | `core/theme/*` | tokens package takes `index.css` as the truth |
| B11 | `SheetActions` stacks buttons on phones, which the CLAUDE.md UI lessons call a failure | `shared/ui/sheet-actions.tsx:13` | app: one row, Cancelar left, primary right |
| B12 | Dead code: `core/theme/tokens.ts`, driver.js CSS `index.css:541-583` | | not ported |

---

## 7. Target architecture

### 7.1 Repo

```
apps/web/                 # git mv frontend apps/web; Vite legacy, production until P19, then deleted
apps/app/                 # universal Expo app: iOS, Android, web
packages/tokens/          # neutrals, palettes, category hex, semantic, scales, resolveTheme, mix/alpha
packages/domain/          # features/*/lib/*, labels, feature catalog + WIP_NOTES, nav model,
                          # SectionTab data, legacy routes + toAppPath, canonicalPath, formatters
packages/api/             # request() with injected ports, ApiError, every features/*/api/*.ts,
                          # upload descriptor type
packages/query/           # query keys + useQuery/useMutation hooks, notify port
backend/ supabase/ config/ scripts/   # unchanged
```

Names: `@propos/web`, `@propos/app`, `@propos/tokens`, `@propos/domain`, `@propos/api`,
`@propos/query`. Rule: **no business logic in `apps/*`**.

Ports injected into `@propos/api` and `@propos/query`:

| Port | Vite (until P19) | App native (`x.ts`) | App web (`x.web.ts`) |
|---|---|---|---|
| `getToken` | supabase-js | supabase-js, D15 adapter | supabase-js default |
| `getTenant`, `getSchema` | `localStorage` | kv-store sync | `localStorage` |
| `baseUrl` | `VITE_API_URL` | `EXPO_PUBLIC_API_URL` | `EXPO_PUBLIC_API_URL` |
| upload part | `File` | `{ uri, name, type }` | `File` |
| `notify` | `sonner` | `sonner-native` | `sonner` |
| `fetch` | window fetch | `expo/fetch` | window fetch |

### 7.2 App tree

```
apps/app/
  app.config.ts          APP_VARIANT (D35); web.output "single"; web.favicon; plugins
  eas.json               profiles development / preview / production, channels, environments
  metro.config.js        SmartPAES pattern: watchFolders = repo root; blockList backend, supabase,
                         data, docs, notebooks, apps/web, _archive
  public/                manifest.webmanifest, icons, push-sw.js (web), .well-known (v1.1)
  scripts/post-export.mjs  writes dist/version.json and the service worker (workbox injectManifest)
  src/app/
    _layout.tsx          providers; splash (native) until fonts + kv + session hydrate; root Stack
                         with Stack.Protected; app-config gate; update-on-resume
    +native-intent.tsx   redirectSystemPath -> toAppPath
    +not-found.tsx
    login.tsx, cambiar-clave.tsx, sin-acceso.tsx, actualizar.tsx
    forgot-password.tsx, auth/setup.tsx, auth/recovery.tsx         web only (P17)
    r/[slug].tsx, p/[slug].tsx, invitacion/[slug].tsx,
    privacidad.tsx, derechos.tsx                                    web only, public (P17)
    admin/[...rest].tsx, agent/[...rest].tsx, buyer/[...rest].tsx,
    content/[...rest].tsx, owner/[...rest].tsx                      D20 redirects (P6)
    (app)/
      _layout.tsx        Stack; shell chooser (D22); TenantSwitchGate; push + AppState; post-call
      (tabs)/            phone shell
        _layout.tsx, index.tsx, clientes.tsx, agenda.tsx, documentos.tsx
      mas.tsx, propo.tsx, pendientes.tsx
      conversaciones/[hilo].tsx
      personas/index.tsx, personas/[id].tsx
      propiedades/index.tsx, propiedades/[id].tsx
      negocios/[id].tsx
      documentos/[id].tsx, documentos/[id]/editar.tsx
      finanzas.tsx, timeline/[table]/[id].tsx, workflows.tsx
      usuarios/index.tsx, usuarios/[id].tsx, telefonos.tsx, tenants.tsx, visitantes.tsx,
      datos/importar.tsx, bandeja.tsx (client inbox), propietario/ (owner portal)
      ajustes/index.tsx, ajustes/funcionalidades.tsx, ajustes/desarrollo.tsx,
      ajustes/clientes.tsx, ajustes/propo.tsx
      _dev/kit.tsx       primitives gallery, __DEV__ only
  src/features/<name>/   one folder per web feature folder
  src/shared/ui/         the kit (8.2)
  src/shared/theme/      ThemeProvider, useTheme, useStyles(makeStyles), useBreakpoint
  src/shared/layout/     usePresentation(): "compact" on native and web < 768 px, "wide" otherwise (D4)
  src/shared/platform/   x.ts + x.web.ts pairs (D13): storage, session, upload, push, audio, files,
                         share, links, update, haptics, scanner, biometric
  .maestro/              native golden flows
  e2e-web/               Playwright web flows
```

On web with the wide shell, `(tabs)` is not rendered: the `(app)/_layout.tsx` shell chooser
renders the sidebar layout around the same screens; tab roots become sidebar entries.
Verify in P0 that expo-router allows this (a `Tabs` layout on phone widths and a `Slot` inside a
sidebar on wide widths); fallback: separate layout groups selected by a redirect at boot.

### 7.3 Libraries

| Need | Native | Web (`.web.tsx` / `.web.ts` or same lib) | Phase |
|---|---|---|---|
| Router | `expo-router` | same | P4 |
| Gestures, animation | `react-native-gesture-handler`, `react-native-reanimated` 4 + worklets | same | P4 |
| Safe areas, screens | `react-native-safe-area-context`, `react-native-screens` | same | P4 |
| Keyboard | `react-native-keyboard-controller` | no-op wrapper | P5 |
| Lists | `@shopify/flash-list` 2 | same | P5 |
| Sheets | `@gorhom/bottom-sheet` 5 behind own `Sheet` | phone width: same; wide: own dialog on RN `Modal` | P5 |
| Menus, pickers, date/time, segmented, switch | `@expo/ui` | `@radix-ui` primitives (DOM, in `.web.tsx`) styled with tokens | P5 |
| Toasts | `sonner-native` behind own `toast` | `sonner` | P5 |
| Icons | `lucide-react-native` + `react-native-svg` (codemod: `AlertTriangle`, `CheckCircle2`, `Loader2`, `PlusCircle`, `*Icon`) | same | P5 |
| Images | `expo-image` | same | P5 |
| Fonts | `expo-font` plugin, static TTF 400/500/600/700 of Archivo, Geist, Geist Mono | same files via `expo-font` | P5 |
| Blur, haptics | `expo-blur` (tab bar), `expo-haptics` | CSS blur via same component, haptics no-op | P5 |
| Storage | `expo-sqlite` kv-store, `expo-secure-store`, `aes-js`, `expo-crypto` | `localStorage`, idb-keyval | P6 |
| Network | `expo-network` | same | P6 |
| Updates, app info | `expo-updates`, `expo-application`, `expo-device`, `expo-constants` | `update.web.ts` (version.json gate) | P6 |
| Links | `expo-linking`, `expo-web-browser`, RN `Share`, `expo-clipboard` | `window.open`, `navigator.share`, clipboard | P7 |
| Audio | `expo-audio` | `expo-audio` web if recording works in P0, else today's MediaRecorder code in `audio.web.ts` | P9 |
| Images in | `expo-image-picker`, `expo-image-manipulator` | picker (file input) + `browser-image-compression` in `.web.ts` | P10 |
| Files | `expo-document-picker`, `expo-file-system`, `expo-sharing` | document picker; cache `.web.ts` on OPFS (today's code); download via `<a download>` | P10 |
| Scanner | SDK 58 `CameraView.scanDocumentAsync` if it proves out in P0, else `react-native-document-scanner-plugin` | none: file input with `capture`, app nudge | P10 |
| PDF view | `react-native-pdf-renderer`; thumbnails from `/v1/documents/:id/thumbnail` | `react-pdf` + pdfjs worker | P10 |
| PDF build | `pdf-lib` | same | P10 |
| QR | `react-native-qrcode-svg` | same | P10 |
| Photo viewer | `react-native-zoom-reanimated` | same if it works on web, else `yet-another-react-lightbox` | P11 |
| Calendar picker | `@marceloterreiro/flash-calendar` | same | P8 |
| Push | `expo-notifications` | today's VAPID code in `push.web.ts` + `public/push-sw.js` | P12 |
| Biometric, quick actions | `expo-local-authentication`, `expo-quick-actions` | hidden | P13 |
| Charts | none in v1 (`x.native.tsx` card); later Expo DOM component if brokers want them on the phone | `recharts` | P17 |
| Maps | `@maplibre/maplibre-react-native` v11 | `maplibre-gl` | P16 |
| Kanban | "Mover a etapa" sheet | `@dnd-kit` | P16 |
| Command palette | search screen | `cmdk` | P16 |
| Share intent, widgets | `expo-share-intent`, `expo-widgets` | n/a | v1.1 |
| Tests | `jest-expo`, RNTL, Maestro | Playwright | P4 |

Rejected: NativeWind, Uniwind, Tamagui, Unistyles (D10); MMKV and AsyncStorage (D14);
`react-native-maps`, `expo-maps` (Google key, no vector styles); `react-native-pdf` (New Arch iOS
blank views); `react-native-calendars` (hard to theme); zeego; react-hook-form (D43); `file-type`
(a 20-line magic-byte check replaces it); `expo-sqlite` on web (WASM + cross-origin isolation).

---

## 8. Mapping

### 8.1 Web API to the app

| Today (Vite) | App native | App web |
|---|---|---|
| `localStorage` (~12 sites) | `storage.ts` kv-store | `storage.web.ts` localStorage |
| supabase default storage | D15 adapter | default |
| idb-keyval persister | kv-store persister | idb-keyval |
| OPFS + IDB document cache | `expo-file-system` `Directory(Paths.cache, "documents")` by sha256 + `expo-sqlite` index; wiped on sign-out and tenant switch | today's OPFS code in `doc-cache.web.ts`, wiped on sign-out and tenant switch |
| service worker, `version.json` gate | EAS Update on `AppState` active (5 min throttle), reload only when no form is dirty; D31 | workbox SW from `post-export.mjs`; `update.web.ts` ports `core/version/*` |
| web push | `expo-notifications`; tap: switch to `data.tenant_id`, `router.push(toAppPath(data.url))`; cold start via `getLastNotificationResponseAsync()` | `push.web.ts` (today's `use-push-subscription.ts`) + `push-sw.js` |
| MediaRecorder, AudioContext, `mic-stream.ts` | `expo-audio` recorder + metering; `setAudioModeAsync` before and after | 11.3 decides; Safari workarounds kept only in `audio.web.ts` if needed |
| getUserMedia camera, custom scanner | image picker camera; native scanner | file input with `capture`; custom scanner deleted |
| heic2any, browser-image-compression | picker JPEG + `expo-image-manipulator` | `browser-image-compression` in `.web.ts`; heic2any dropped (web desktop rarely sees HEIC; the picker converts on iOS Safari) |
| `<input type=file>`, drag and drop | action sheet Cámara / Fotos / Archivos | document picker + drop zone in `.web.tsx` |
| FormData with `File`, Storage uploads | one `toUploadPart()` | same helper, `File` branch |
| `URL.createObjectURL`, `<a download>` | file URIs; `Sharing.shareAsync` | unchanged |
| `navigator.share`, clipboard, vibrate | RN `Share`, `expo-clipboard`, `expo-haptics` | unchanged |
| `tel:`, `mailto:`, `wa.me`, Waze/Maps | `Linking.openURL`; `LSApplicationQueriesSchemes` for `waze`, `comgooglemaps` | `Linking.openURL` |
| `target=_blank` | `expo-web-browser` | new tab |
| user agent as consent evidence | `PropOS/<version> (<os> <osVersion>; <model>)` | `navigator.userAgent` as today |
| `fetch(keepalive)` telemetry | flush on `AppState` background; buffer in kv-store | `fetch(keepalive)` on `visibilitychange` as today |
| `getReader()` streaming | `expo/fetch` | window fetch |
| viewport store, `use-keyboard-inset`, `interactive-widget` | keyboard-controller + safe areas | keep the `index.html` viewport meta in the web template; `visualViewport` only if P18 finds a keyboard defect |
| `createPortal` (8) | modal routes, `headerRight` | same |
| `use-dismiss-on-back`, `use-sheet-drag`, `use-scroll-lock` | native | browser back closes modal routes (router history) |
| IntersectionObserver, ResizeObserver, matchMedia | FlashList, `onLayout`, `useWindowDimensions` | same |
| `document.title` | screen `title` | expo-router sets `document.title` from `title` (verify P0) |
| realtime (client chat) | resubscribe + refetch on active | as today |
| cmdk | search screen | cmdk `.web.tsx` |
| dnd-kit kanban | "Mover a etapa" sheet | dnd-kit `.web.tsx` |

### 8.2 Component kit (`apps/app/src/shared/ui`)

Every primitive reads tokens, never raw numbers or hex. Build order as listed.

| Primitive | Replaces | Notes |
|---|---|---|
| `Text` (display, title, body, label, caption, mono) | h1-h3, Tailwind type | `maxFontSizeMultiplier` 1.4; `includeFontPadding: false` Android; tabular-nums role; `selectable` on web data text |
| `Button` (default, destructive, outline, secondary, ghost, ink; sm, md, block) | shadcn button | `Pressable`; haptic native; hover and focus ring web; min target 44 iOS / 48 Android / 40 web pointer-fine |
| `TextField` | input, textarea, `Field` | placeholder-first; label as `accessibilityLabel` |
| `Card`, `Pill`, `Row`, `RoundButton`, `SectionLabel`, `ActionIcon`, `WorkspacePill` | same | direct ports; `Row` hover-reveal actions on web |
| `Skeleton`, `PageSkeleton` | react-loading-skeleton | reanimated; reduced motion |
| `ErrorState`, `EmptyState`, `WipState`, locked screen, `WipNotice` | same | every screen: loading, error with retry, empty |
| `Screen` | page shell | safe areas; header actions; `--page-x` as `useBreakpoint().gutter` |
| `ListScreen` | `ListShell`, `ResponsiveTable`, `LoadMore` | FlashList; phone rows, wide table columns |
| `MasterDetail` | same | wide: two panes; phone: stack push |
| `Sheet`, `ResponsiveSheet`, `SheetActions` | BottomSheet, Dialog, Popover | phone sheet, wide dialog; `SheetActions` one row (B11), above keyboard |
| `SegmentedTabs` | `SectionTabs`, `TabBar`, `Segmented` | D23 |
| `FilterSelect`, `Chips`, `ChoiceSwitch`, `ViewToggle`, `LinkInput`, `Menu` | same, dropdown-menu | `@expo/ui` native, Radix `.web.tsx` |
| `confirm()` | alert-dialog | `Alert.alert` native; dialog web |
| `toast` | sonner | D18 table |
| `SwipeAction` | swipe-action | native only; web shows the row actions on hover |
| `AudioPlayer`, `Recorder`, `PhotoViewer`, `MonthGrid`, `TimeGrid`, `PropoMark`, brand marks | same | |
| Web-only pieces | sidebar, command palette, tooltip | `.web.tsx`; not rendered on native |

### 8.3 UI rules (added to the CLAUDE.md UI lessons when the app lands)

All current lessons still apply, except the `cn()`/tailwind-merge one (style arrays, later wins).
New:

| Rule | |
|---|---|
| Platform files | capabilities only through `shared/platform` pairs (D13); no `Platform.OS` in features |
| Presentations | compact tested at 360 and 412 (native and web); wide tested at 1280 (web). A compact screen never grows a table; a wide screen never hides an action behind a sheet when there is room |
| Safe areas | `Screen` owns insets; Android edge-to-edge is mandatory |
| Keyboard | forms and composers use keyboard-controller primitives; test with the keyboard open at 360 dp |
| Back | Android back and browser back close the top sheet or modal first |
| Haptics | light on toggle, select, swipe commit; success on save; nothing on navigation |
| Touch floor | 44 iOS, 48 Android; web pointer-fine 40 |
| Font scale | cap 1.4; fixed-height controls grow, never clip |
| Idioms | native menus, date pickers and confirms on native; hover and focus ring only on web |
| Lists | FlashList for anything that can pass 30 rows |
| Radii | `innerRadius(outer, inset)`; `borderCurve: "continuous"` on cards |
| Motion | no `entering` layout animations; native transitions only |

### 8.4 Security rules

- Native session only through D15; SecureStore holds only the AES key and the biometric flag.
- Sign-out and tenant switch wipe, on every platform: query cache, persisted cache, document cache and its index, telemetry buffer; native also deletes its push token (`DELETE /v1/notifications/devices/{token}`).
- `X-Db-Schema` sent only when `__DEV__` or variant `development`.
- Never in git: service-role key, APNs `.p8`, FCM service account, Play service account, `google-services.json`, `GoogleService-Info.plist`, `credentials.json`, `*.keystore`, `*.jks`, `*.p12`, `*.mobileprovision`, Expo tokens. Added to `.gitignore` in the commit that creates `apps/app`. The repo is public.

---

## 9. Backend changes

### 9.1 List

| # | Change | Phase | Migration |
|---|---|---|---|
| K1 | D37 transcription filename and MIME | P1 | no |
| K2 | D30 push fixes (server-derived deep link, honest delivery, async web push, real retries) | P1 | no |
| K3 | `push_devices` + `push_deliveries`, RLS (owner manages own rows), no audit trigger on deliveries | P12 | **yes** |
| K4 | `POST /v1/notifications/devices` (upsert on token, re-assigns `user_id`), `DELETE /v1/notifications/devices/{token}` | P12 | no |
| K5 | `notifications/push/{webpush,expo}.py` + `dispatch_push(user_id, message)`; Expo batches of 100; `DeviceNotRegistered` disables at once | P12 | no |
| K6 | Receipts checked at the start of each `propos-reminders` run for tickets older than 15 min | P12 | no |
| K7 | `GET /v1/app/config` (`min_supported_build`, `store_url`) from settings | P6 | no |
| K8 | `POST /v1/users/me/delete-request`: deactivates own account, notifies tenant admins | P14 | maybe |
| K9 | Secret `expo-access-token` mounted like the other optional secrets | P12 | no |
| K10 | v1.1: `POST /v1/documents/upload-url` (signed Storage upload) | v1.1 | no |
| K11 | Push payload `url` becomes role-less (D21) once the app serves production web | P19 | no |

### 9.2 Push schema

```sql
CREATE TABLE push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id),              -- last active workspace, informational
  token text NOT NULL UNIQUE,                         -- ExponentPushToken[...]
  platform text NOT NULL CHECK (platform IN ('ios','android')),
  app_variant text NOT NULL CHECK (app_variant IN ('development','preview','production')),
  app_version text, build_number text, runtime_version text, device_name text, os_version text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz, disabled_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON push_devices(user_id) WHERE disabled_at IS NULL;

CREATE TABLE push_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES push_devices(id) ON DELETE CASCADE,
  reminder_id uuid REFERENCES reminders(id),
  ticket_id text, ticket_status text NOT NULL,
  receipt_status text, error text,
  created_at timestamptz NOT NULL DEFAULT now(), receipt_checked_at timestamptz
);
```

User-scoped fan-out: add the `# tenant-safe:` escape expected by
`backend/tests/test_tenant_predicate.py`. After applying: `make test-schema-rebuild`.

### 9.3 Push message (both transports read `data.url`)

```json
{"to":"ExponentPushToken[..]","title":"Recordatorio","body":"...","sound":"default",
 "priority":"high","channelId":"recordatorios","categoryId":"reminder",
 "data":{"url":"/admin/agenda?tab=tareas&id=<uuid>","tenant_id":"<uuid>",
         "kind":"reminder","target_table":"tasks","target_row_id":"<uuid>"}}
```

Android channels `recordatorios` (HIGH), `general` (DEFAULT). Category `reminder`: "Hecha",
"Posponer 1 h", both open the app. Permission asked from the Cuenta row, never at launch. Token
registered on every authenticated launch.

---

## 10. Environments and dev loop on `workstation`

| Thing | Value |
|---|---|
| Metro (native + web dev) | port **8084** (8081 to 8083 taken, 5173 Katitos, 5174 PropOS Vite, 8000 API). `REACT_NATIVE_PACKAGER_HOSTNAME=workstation`, `--host lan` |
| Web dev in a browser | `http://workstation:8084` (Metro serves web); for the iPhone browser `tailscale serve --bg --https=9445 8084` |
| API for the iPhone | `tailscale serve --bg --https=8444 8000` gives `https://workstation.tailb2b505.ts.net:8444` |
| API for the Android emulator | `adb reverse tcp:8000 tcp:8000`, `http://127.0.0.1:8000`; cleartext only in the `development` variant (`expo-build-properties`) |
| API for web dev | `EXPO_PUBLIC_API_URL=http://localhost:8000`; CORS `ALLOWED_ORIGINS` in the local `.env` must include `http://localhost:8084` (log it for the owner if missing; never edit `.env` silently) |
| Android toolchain | `~/Android/sdk`, `~/Android/jdk` (JDK 17), installed for SmartPAES. `export ANDROID_HOME=~/Android/sdk JAVA_HOME=~/Android/jdk` |
| Emulator | new AVD `propos` (`system-images;android-35;google_apis;x86_64`, `pixel_6`), created like `~/Android/setup-emulator.sh`. Automation: `adb exec-out screencap`, `uiautomator dump` (`smartpaes/scripts/ui/native.sh`, `native-bot.py`) |
| Web screenshots | Playwright at 360 x 780, 412 x 915, 1280 x 800 (SmartPAES `scripts/ui/shots.mjs` pattern) |
| Local Android dev build | `APP_VARIANT=development npx expo run:android --port 8084` (no EAS account needed) |
| iOS dev build | `eas build --profile development --platform ios` (cloud; needs 3.3 items 1, 5, 6) |
| Web export | `npx expo export -p web` then `node scripts/post-export.mjs`; serve `dist/` with `npx serve -s dist -l 8091` for the parity checks |
| Logs | `~/propos-app-dev.log`, `~/propos-api.log`; detached with `setsid nohup`; stop by port (`fuser -k 8084/tcp`) |
| Data during unattended runs | local backend on 8000 with the root `.env`; sign in as the O1 account; everything inside `PropOS Demo` |

Env vars per environment: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WEB_URL`
(`https://app.propos.cl` / `https://dev.propos.cl`), `EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_APP_ENV`, `EXPO_PUBLIC_VAPID_PUBLIC_KEY` (web only).
Supabase auth and Storage are shared by all environments.

---

## 11. Execution plan

### 11.1 Protocol for unattended runs (read before every run)

1. **Branch**: create `expo-migration` from `dev` once; every run continues there. Commit per the
   CLAUDE.md style (`<type>(<scope>): :gitmoji: <summary>`, subject only, no body, **no
   Co-Authored-By**), one change per commit. **Never push, never merge, never deploy.** The
   monorepo move breaks Vercel until the owner changes Root Directory (3.3 item 7).
   Files carrying the owner's uncommitted edits (today `CLAUDE.md`, `frontend/vite.config.ts`,
   `docs/versions/*`) are staged hunk by hunk: commit only the run's own hunks.
2. **Never**: `make migrate`, `make deploy*`, `make query-write`, seed or reset scripts,
   `eas update`, `eas submit`, `tailscale funnel`, `scripts/dev_hmr.sh`; writes to any tenant
   except `PropOS Demo`; printing or copying `.env` values; editing `~/.claude/CLAUDE.md`.
3. **Run log**: append to `docs/research/expo-migration/RUNLOG.md` (gitignored) after each task:
   phase, task, commit hash, gate result, anything skipped and why. A run starts by reading it and
   the last 20 commits.
4. **Gates**: a task is done only when its gate passes. On failure: fix and retry up to three
   times; then revert that task's uncommitted work, log it BLOCKED with the exact error, and move
   to the next task that does not depend on it. Never weaken, skip or delete a test to pass.
5. The porting recipe (11.4) is the unit of work for P7 to P11 and P16 to P17.
6. Heavy commands run under `nice` and `systemd-run --scope -p MemoryHigh=24G`. At the end of a
   run: `ws-notify` with the phase reached and the BLOCKED count.
7. When a version or API named here differs from reality, trust reality, keep the decision's
   intent, and log the difference.
8. Keep going: when a phase ends inside a run, start the next one. Stop only at the end of the
   time box, at a BLOCKED item that everything remaining depends on, or at an owner item from 3.

### 11.2 Phases

Agent time assumes ~10-hour unattended runs with the gates below; the owner reviews between runs.

| Phase | Content | Gate (all must pass) | Agent time |
|---|---|---|---|
| **P0 Preflight** | Verify at start (11.3). AVD `propos`. Write `backend/scripts/seed_mobile_test_user.py` (not run) for O1. Create `RUNLOG.md`. | 11.3 answered in RUNLOG; `emulator -avd propos` boots; `adb devices` lists it | 1 h |
| **P1 Fixes** | B1 to B5, B7, K1, K2. One commit each. | `cd frontend && npm run typecheck && npm run lint && npm test && npm run build`; `cd backend && poetry run pytest --no-cov -q`; `make lint` | 2 h |
| **P2 Monorepo** | `git mv frontend apps/web`; root `package.json`, `pnpm-workspace.yaml` (`apps/*`, `packages/*`, `nodeLinker: hoisted`), `.npmrc` (SmartPAES), `turbo.json`; `frontend/package-lock.json` replaced by `pnpm-lock.yaml`; Makefile `cd frontend` to `pnpm --filter @propos/web`; `ci.yml` (pnpm, `working-directory: apps/web`, **same job names**, `pnpm audit`); `.gcloudignore` (add `/apps/`, `/packages/`, `node_modules/`, `pnpm-lock.yaml`); root `vercel.json` merged into `apps/web/vercel.json`; `catalog.test.ts` backend path; `scripts/commit-all.sh`; `.gitignore` `lib/` negations; `docker-compose.yml`, `config/docker/frontend.Dockerfile`; CLAUDE.md paths and B9. Log the Vercel step for the owner. | `pnpm install --frozen-lockfile`; `pnpm --filter @propos/web typecheck lint test build`; `git status --ignored -s apps/web/src` prints nothing; `make lint`; `dist/` file list equal to a pre-move build except hashes | 2 h |
| **P3 Packages** | `tokens` (neutrals `index.css:320-455`, `PALETTE_DEFS` verbatim, category hex from research 20, semantic, scales, `resolveTheme`, `mix`, `alpha`, `innerRadius`, contrast test 11 palettes x 2 modes); `domain` (pure files from research 40 section 3, `toAppPath` + tests from `route-redirects.test.tsx`, SectionTab data, nav model split from icons); `api` (7.1 ports); `query` (hooks with `notify`). Vite imports from the packages; no behaviour change. | 37 pure tests green in the packages; `pnpm --filter @propos/web typecheck lint test build`; `pnpm -r typecheck` | 5 h |
| **P4 Scaffold** | `apps/app` from the SDK template (D7) with web enabled; `app.config.ts` (D35), `eas.json`, `metro.config.js`, tsconfig paths, eslint, `jest-expo` + RNTL, Playwright, `.gitignore` credential list; first Android dev build; placeholder screen on native and web. | `pnpm --filter @propos/app typecheck lint test`; `npx expo-doctor`; `npx expo export -p android -p ios -p web`; `expo run:android` installs; screenshots of the placeholder on the emulator and in Playwright | 2 h |
| **P5 Theme + kit** | `ThemeProvider` (D12), fonts, splash gate, `useBreakpoint`, platform-file skeletons (D13), primitives in 8.2 order, `_dev/kit` gallery. | kit gallery shots: emulator dark and light at font scale 1.0 and 1.4; web at 360 and 1280 px; stored in `docs/research/expo-migration/shots/P5/`; compared with web tokens; jest tests for `Button`, `TextField`, `SegmentedTabs`, `ErrorState` | 8 h |
| **P6 Shell + auth** | storage (D14), session (D15), persistence (D16), `use-auth` port (boot dedup, tenant switch), root layout and guards (D25), login, cambiar-clave, sin-acceso, D20 redirect routes, phone shell (D22), Más, `ScreenGate`, telemetry, K7 + actualizar, update-on-resume, offline banner. | with O1, on emulator and web at 412 px: sign in, reach Inicio, open Más, switch theme, sign out (caches wiped, verified by listing keys); `/admin/personas` on web redirects to `/personas`; Maestro `login.yaml` and Playwright `login.spec.ts` pass; without O1: log BLOCKED, stop | 8 h |
| **P7 Clientes** | Conversaciones + thread + realtime + composer; Negocios stage list + move sheet; deal detail; Personas list/detail; interactions. | 11.4 per screen; Maestro `reply.yaml` | 10 h |
| **P8 Agenda** | tasks, notes (voice), calendar month and day/week, event form. | 11.4; Maestro `task.yaml` | 10 h |
| **P9 Propo + Pendientes** | streaming, recorder with waveform, proposal cards and disambiguation, Pendientes. | 11.4; a voice note transcribes end to end locally (needs K1); Maestro `pendiente.yaml` | 8 h |
| **P10 Documentos** | list, viewer, upload action sheet, scanner, pdf-lib assembly, share link + QR, file cache with wipe. | 11.4; a scanned 2-page PDF uploads and opens; Maestro `scan.yaml` | 10 h |
| **P11 Propiedades, Inicio, UF, Cuenta** | list, detail, gallery + upload, form; Inicio tiles; UF; Cuenta (all roles). | 11.4 | 8 h |
| **P12 Push** | K3 migration file (not applied), K4, K5, K6, K9; native client (permission row, channels, category, token, tap handler with tenant switch); web push moved into `push.web.ts`. | backend unit tests with a mocked Expo API; jest tests for `toAppPath` on every push URL shape; end-to-end waits for K3 applied and FCM credentials (log it) | 4 h |
| **P13 Native extras** | quick actions, post-call prompt, biometric unlock, haptics pass. | 11.4 for touched screens; quick action opens the right screen via `adb shell am start` | 4 h |
| **P14 Store readiness** | K8 + "Eliminar mi cuenta"; AI consent draft (O3); Spanish permission strings; `ios.privacyManifests`; `ITSAppUsesNonExemptEncryption: false`; icons, splash; reviewer notes template. | 11.5 complete except owner items | 3 h |
| **P15 Release plumbing (native)** | CI job "App (tsc + eslint + test + expo-doctor + export)" outside `REQUIRED_CHECKS`; preview OTA Action (disabled until `EXPO_TOKEN`); make targets (`dev-app`, `app-android`, `app-shots`, `app-tunnel`, `app-tunnel-off`, `app-build-dev`, `app-update-preview`, `app-update-prod`). | `actionlint`; `make -n` for each target | 2 h |
| **P16 Wide presentation** | sidebar layout (D22), header, command palette, wide presentation (D4) for every P7 to P11 screen: tables, `MasterDetail`, hover actions, bulk actions; kanban `.web.tsx`; property map (web and native v11). | 11.4 at 1280 px for every ported screen, compared with the Vite app at the same width | 10 h |
| **P17 Remaining screens** | everything in 4.2 not done in P16: Finanzas + analytics + usage + Propo cost, timeline, email, admin screens, catalogs, Propo policies, workflows, documents editor + versions + Enlaces + portal admin, client inbox, owner portal, public pages, auth landings. | 11.4 per screen; Playwright flows: invite landing, recovery, public share `/r/`, portal upload `/p/`, visitor registration | 20 h |
| **P18 Web platform** | manifest, icons, `post-export.mjs` (version.json + workbox SW), web push end to end, `update.web.ts`, Vercel config for `apps/app` (`buildCommand`, `outputDirectory: dist`, SPA rewrite, headers from today's `vercel.json`), D19 bundle budget. | Lighthouse PWA installable; web push test notification on the local build; bundle report under budget; route parity check (11.6) prints zero missing routes | 6 h |
| **P19 Cutover prep** | Precondition (owner): native app live in both stores and the ANAIDA brokers using it. CI: app job replaces the Vite job names in `REQUIRED_CHECKS`; Makefile and CLAUDE.md point at `apps/app`; K11; a commit that deletes `apps/web` kept **last** on the branch so the owner can merge everything before it first. | full parity check (11.6) green; all Playwright and Maestro flows green; owner steps logged (3.3 item 7) | 3 h |

Totals: native v1 (P0 to P15) about 85 hours of agent time; web parity and cutover (P16 to P19)
about 40 hours. **About 11 to 14 runs of ~10 hours.** Run 1 targets P0 to P6.

### 11.3 Verify at start (P0)

Record each answer in RUNLOG. None of these may be assumed from this document.

1. Latest stable Expo SDK today; apply D7. If 58: confirm the JS tabs import path and whether `CameraView.scanDocumentAsync` works on Android.
2. expo-router: one route tree with a `Tabs` layout on phone widths and a sidebar `Slot` on wide web widths (7.2); async routes on web in production; `document.title` from screen `title`.
3. `web.output: "single"` and how to supply the HTML template (viewport meta, theme-color, manifest link).
4. `expo-sqlite/kv-store` sync API name (`getItemSync`).
5. `expo-audio`: recording API names, metering option, and whether recording works on web (Safari included).
6. `expo-file-system` default export is the new `File`/`Directory` API.
7. `@gorhom/bottom-sheet` works with the pinned Reanimated; else `@expo/ui` BottomSheet on native.
8. `jest-expo` peer conflict (expo/expo#47435) resolved or needs a pin.
9. `react-native-pdf-renderer`, `react-native-document-scanner-plugin`, `sonner-native`, `react-native-zoom-reanimated` (also on web), `lucide-react-native` install cleanly under New Architecture.
10. `pnpm@12.4.2` through corepack; `~/Android/sdk`, `~/Android/jdk`, `/dev/kvm` present; ports 8084, 8091, 8444, 9445 free.

### 11.4 Recipe: porting a screen

1. Read the web page, its components and hooks. List endpoints, gates (feature key, scope, role), URL params, states, widths it adapts to.
2. Hooks come from `@propos/query`; a hook still in `apps/web` moves to the package first (separate commit, Vite keeps working).
3. Build from the kit only. A pattern needed twice becomes a primitive. Capabilities only through `shared/platform`.
4. Every screen: loading skeleton, error with retry, empty state, `ScreenGate`.
5. Strings verbatim from the web or `@propos/domain`. No em dash, no middot.
6. Gate: `pnpm --filter @propos/app typecheck lint test`; shots, dark and light: emulator at 360 x 780 and 412 x 915 (`adb shell wm size`), font scale 1.0 and 1.4, keyboard open for forms; web at 360 and 412 px (compact); from P16, web at 1280 px (wide); saved in `docs/research/expo-migration/shots/<phase>/`. Wide: content and action parity with the Vite page at 1280 px (Vite dev on 5174). Compact: every difference from the Vite page at 412 px is either fixed or logged in `COMPACT-DIFFS.md` (D4a).
7. One commit per screen: `feat(app): :sparkles: port <screen> screen`.

### 11.5 Store checklist (P14)

- [ ] Reviewer account (O1) in `PropOS Demo`, credentials only in review notes
- [ ] "Eliminar mi cuenta" in Cuenta (K8); web URL `/derechos` for the Play form
- [ ] AI consent before first Propo use; `/privacidad` names Groq
- [ ] Spanish usage strings: camera, microphone, photo library, Face ID
- [ ] `ios.privacyManifests`; Play Data safety answers drafted
- [ ] `ITSAppUsesNonExemptEncryption: false`
- [ ] No pricing or purchase UI
- [ ] Icons (iOS, Android adaptive + monochrome), splash light and dark

### 11.6 Parity check (P18, P19)

A script `apps/app/scripts/route-parity.mjs` reads every `path=` in `apps/web/src/app/router.tsx`
and `apps/web/src/app/legacy-routes.ts`, expands the role trees, and requests each path from the
exported web app (`npx serve -s dist -l 8091`) with Playwright signed in as O1. Every path must
land on a screen (not `+not-found`) and match the Vite app's target screen. It prints missing and
mismatched routes; zero is the gate.

---

## 12. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| react-native-web desktop quality below the Vite app (dense tables, text selection, shortcuts) | admins notice a downgrade at cutover | wide presentation files, `.web.tsx` for dense pieces; P16 compares every screen at 1280 px; cutover waits for the owner's approval |
| Compact redesign drifts from what brokers need | a faster screen that misses a daily action | D4a diff log reviewed by the owner after each phase; no action removed, only moved |
| Phone web users (today: the ANAIDA brokers on the PWA) lose the compact Vite layout at cutover | regression for phone users | cutover precondition: the native app is in the stores and ANAIDA users are on it; web below 768 px still serves compact |
| Web bundle heavier than today | slower first load | D19 budget measured in P18; heavy libs only in lazy `.web.tsx` |
| One route tree for two shells hits an expo-router limit | shell rework | checked in P0 (11.3 item 2) before any screen exists |
| Documents is the largest area (9.4k lines) and the most used on a phone | schedule | editor and versions in P17 |
| Propo streaming through `expo/fetch` untested against our chunking | Propo UX | spike first in P9; fallback non-streamed reply |
| Breaking API change while old binaries are installed | broken app for brokers | D31, D32 |
| Staging OTA published with production env | staging writes to production | D34; API host shown in Cuenta > Desarrollo |
| Monorepo move or cutover breaks Vercel | web outage | never pushed by unattended runs; owner merges `dev` first (`prop-os-edge`), then `main`; `apps/web` deletion is the last commit and can wait |
| Cross-tenant data on a shared phone | privacy leak | 8.4; push token re-assigned on upsert, deleted on sign-out |
| gorhom or sonner-native lag an SDK | broken sheets or toasts | own wrappers; `@expo/ui` BottomSheet and `burnt` as fallbacks |
| Store rejection (AI data, deletion, demo access) | slip | P14 before the first submission |
| pdf-lib memory on low-end Android | out of memory | cap at 50 MB; scanner returns JPEG pages; server-side merge if needed |

---

## 13. Research index

| File | Covers |
|---|---|
| `00-stage1.md` | inventory, sizes, web-only surface counts |
| `10-routing-auth.md` | every route with gates and line numbers, legacy redirects, guards, shells, auth flow, `core/` port map |
| `20-ui-styling.md` | token tables, category hex values, component inventory with consumer counts, styling library evaluation |
| `30-platform-apis.md` | every browser API call site with its native replacement, offline and update design |
| `40-screens-libs.md` | all 30 feature folders with endpoints and gates, heavy library picks, shareable logic by file, tests |
| `50-backend-infra.md` | push end to end, API surface, uploads, monorepo move cost, EAS, store review, dev loop |
| `60-native-capabilities.md` | 28 native capabilities ranked, losses, v1 / v1.x / later split, sources |

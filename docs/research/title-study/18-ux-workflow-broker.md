# 18 — UX Workflow Broker (Title Safeguard)

> **Audiencia**: PM + designer + frontend eng PropOS.
> **Stack base**: React 19 + Tailwind v4 + shadcn/ui + dark theme only + Spanish UI / English code (regla CLAUDE.md). Ruta canónica: `/admin/title-safeguard` (NO `/admin/safeguard-titulos`).
> **Glosario rápido**: CBR = Conservador Bienes Raíces. CGP = Certificado Gravámenes y Prohibiciones. FNA = Foja Número Año. DOM = Dirección Obras Municipales. TGR = Tesorería General República. SII = Servicio Impuestos Internos. DGA = Dirección General Aguas. PE = Posesión Efectiva. GP = Gravámenes y Prohibiciones (certificado vencimiento 30d).

Documento define UX end-to-end del feature **Title Safeguard** (estudio de título automatizado pre-listing) dentro de PropOS. Cubre personas, JTBD, flow de ingesta, vista de resultados, drawer de flag, dashboard portfolio, notificaciones, integración con flow venta, edge cases, mobile/PWA, onboarding, métricas y pricing UX.

---

## 1. Personas

5 personas. Cada una rol distinto en sidebar (`NAV_ITEMS_BY_ROLE` en `frontend/src/layouts/app-sidebar.tsx`). Permisos diferenciados por RLS Supabase.

### 1.1. Captador (`role=captador`)

- Quien levanta propiedad en terreno. Visita casa, fotografía escritura, ingresa al CRM.
- Tech literacy: media-baja. iPhone Android mezclados. PWA principal, no desktop.
- Dolor: pasar 2 semanas con un listing y enterarse al final que tiene hipoteca sin alzar = comisión perdida.
- Necesita: claridad inmediata 🟢🟡🔴, no jerga legal, no formularios largos.

### 1.2. Vendedor inmobiliaria (`role=vendedor`)

- Cierra trato con comprador. Toma listings que el captador levantó.
- Tech literacy: media. Mezcla móvil + desktop.
- Dolor: comprador descubre flag rojo en visita notario, deal se cae.
- Necesita: ver flags antes de mostrar propiedad, snapshot legal para enviar a comprador como confianza.

### 1.3. Manager / dueño inmobiliaria (`role=admin`)

- Gestiona equipo captadores + vendedores. Mide performance.
- Tech literacy: alta. Desktop principal.
- Dolor: no sabe qué % portfolio es vendible, no sabe qué captador trae basura legal.
- Necesita: dashboard agregado, comparativas equipo, alertas red flags.

### 1.4. Cliente final propietario (`role=client`)

- Dueño de la propiedad que quiere vender. No es usuario regular del producto.
- Tech literacy: baja-media. Recibe link via WhatsApp/email, no se loguea por sidebar.
- Dolor: no entiende qué pidió la inmobiliaria, no sabe si su propiedad está "ok".
- Necesita: vista pública con un solo veredicto + qué pasos faltan + estimado costo. Cero jerga.

### 1.5. Abogado externo aliado (`role=lawyer`)

- Estudio jurídico que la inmobiliaria contrata por ticket cuando flag amerita revisión.
- Tech literacy: media-alta. Desktop.
- Dolor: recibe casos por email PDF disperso, sin contexto, sin acceso a documentación bruta.
- Necesita: bandeja tickets, drawer con todos artefactos (FNA, escrituras, certificados), permisos de solo-lectura sobre el estudio + escritura sobre notas/recomendación.

---

## 2. Jobs To Be Done

Formato JTBD: *Cuando X, quiero Y, para Z*.

- **Captador**: Cuando llego a una casa con la dueña, quiero saber en <5 min si la propiedad es vendible, para decidir si firmo mandato o me voy.
- **Vendedor**: Cuando agendo visita con comprador, quiero adjuntar un PDF de salud legal del título, para responder objeciones sin llamar al abogado.
- **Manager**: Cuando reviso pipeline mensual, quiero ver % listings rojos por captador, para coachear o despedir.
- **Cliente final**: Cuando me dicen que mi casa "tiene un problema legal", quiero ver en español simple qué problema y cómo se arregla, para no sentirme estafado.
- **Abogado**: Cuando recibo un ticket safeguard, quiero todos los documentos y razonamiento del sistema en una sola pantalla, para cobrar honorarios fijos en lugar de horas perdidas.

---

## 3. Flow ingesta (step-by-step)

Objetivo: del captador parado en la cocina de la dueña al **semáforo definitivo** en bajo 5 minutos (90% casos automáticos en <60s, async para CBR ~1-3 días).

### 3.1. Step 1 — Form mínimo

```
┌──────────────────────────────────────────────┐
│  Nueva propiedad                          ✕  │
├──────────────────────────────────────────────┤
│  Dirección                                   │
│  ┌──────────────────────────────────────┐    │
│  │ Av. Apoquindo 4500, Las Condes      🔍│   │ ← autocomplete Google Places
│  └──────────────────────────────────────┘    │
│                                              │
│  RUT propietario                             │
│  ┌──────────────────────────────────────┐    │
│  │ 12.345.678-9                          │   │ ← validación dígito verif
│  └──────────────────────────────────────┘    │
│                                              │
│  ¿Tienes copia de la escritura?              │
│  ( ) Sí, tengo foto    ( ) No, después       │
│                                              │
│  [ Continuar ]                               │
└──────────────────────────────────────────────┘
```

- **Solo 2 campos obligatorios**: dirección + RUT. Todo lo demás se infiere o queda async.
- Autocomplete con Google Places. Al seleccionar, capturamos lat/lng/comuna/código postal.
- RUT con validación dígito verificador (módulo 11) inline.

### 3.2. Step 2 — Drag-drop foto escritura

```
┌──────────────────────────────────────────────┐
│  Foto escritura                       2 / 5  │
├──────────────────────────────────────────────┤
│  ┌──────────────────────────────────────┐    │
│  │                                      │    │
│  │     📄  Arrastra escritura aquí      │    │
│  │     o pulsa para usar cámara         │    │
│  │                                      │    │
│  │     PDF, JPG, PNG · max 30 MB        │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  💡 Tip: foto de la primera página.          │
│     Buscamos foja, número y año.             │
└──────────────────────────────────────────────┘
```

- Mobile: tap → se abre `<input capture="environment">` directo a cámara nativa.
- Desktop: drag-drop estándar shadcn `<Dropzone>`.
- Multi-archivo OK (cliente entrega varias páginas sueltas).

### 3.3. Step 3 — Vision LLM extrae FNA, captador confirma

LLM (Claude Sonnet vision) parsea imagen → extrae FNA + nombre titular + comuna CBR. Captador valida en formulario pre-rellenado:

```
┌──────────────────────────────────────────────┐
│  Confirma datos extraídos            3 / 5   │
├──────────────────────────────────────────────┤
│  Foja        [ 12345        ]  ✓ alta conf   │
│  Número      [ 6789         ]  ✓ alta conf   │
│  Año         [ 2018         ]  ✓ alta conf   │
│  CBR         [ Santiago     ]  ⚠ baja conf   │ ← amarillo, pide revisar
│  Titular     [ JUAN SOTO M. ]  ✓ alta conf   │
│                                              │
│  [ ← Atrás ]              [ Iniciar ▶ ]      │
└──────────────────────────────────────────────┘
```

- Cada campo trae score de confianza vision LLM. Bajo conf → resaltado amarillo + tooltip "verifica este dato".
- Botón **Iniciar safeguard** dispara el job async. Captador no espera en pantalla.

### 3.4. Step 4 — Scrapers paralelos + CBR async

Backend dispara N jobs paralelos vía worker queue (Celery / RQ / Hatchet). UI muestra progress stepper (PatternFly-style) con estados durables polling al endpoint:

```
┌──────────────────────────────────────────────┐
│  Verificando…                        4 / 5   │
├──────────────────────────────────────────────┤
│  ● SII avalúo fiscal              ✓ 0:08     │
│  ● TGR contribuciones             ✓ 0:11     │
│  ● DGA derechos de agua           ✓ 0:14     │
│  ● DOM permiso edificación        ⏳ 0:23     │
│  ● Registro Civil titular         ✓ 0:09     │
│  ● CBR CGP (asíncrono)            🕐 ~24-72h │
│                                              │
│  💡 Puedes cerrar esta pantalla.             │
│     Te avisamos por push.                    │
│                                              │
│              [ Ver resultado parcial ]       │
└──────────────────────────────────────────────┘
```

- Scrapers síncronos típicos: 5-30s. SSE/WebSocket o polling cada 2s.
- CBR async: legal-tech humano-en-loop o RPA con cola, ETA visible.
- "Puedes cerrar" es crítico — captador no puede esperar parado en cocina.

### 3.5. Step 5 — Semáforo definitivo

Cuando todos los verifiers cierran (excepto CBR si aún async, que muestra estado parcial pero no bloquea preview), se computa el veredicto agregado.

---

## 4. Vista resultado (hero semáforo)

ASCII mockup pantalla detalle propiedad post-safeguard:

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Volver       Av. Apoquindo 4500, Las Condes        ⚙ Acciones│
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌────────────────────────────────────────────────────────┐    │
│   │                                                        │    │
│   │             🟡  AMARILLO                               │    │
│   │             Vendible con remediación                  │    │
│   │                                                        │    │
│   │   2 banderas amarillas · 0 rojas · 1 verde            │    │
│   │   Tiempo estimado fix: 7-30 días                       │    │
│   │   Costo estimado: $80k - $300k                         │    │
│   │                                                        │    │
│   │   [ Ver plan de acción ]   [ Compartir con cliente ]   │    │
│   └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Banderas detectadas                                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 🟡 Hipoteca BancoEstado sin alzar (2003)            →    │   │
│  │ 🟡 Recepción final DOM ausente (ampliación 2015)    →    │   │
│  │ 🟢 Contribuciones al día                            →    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Recomendación PropOS                                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Listing publicable bajo "venta con saneamiento". Pide   │   │
│  │ a cliente carta cancelación BancoEstado y solicitud    │   │
│  │ recepción definitiva DOM. Estimado 21 días.            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Snapshot legal: PropertyTitle-2026-05-07-1430.pdf  [ ⬇ ]       │
└──────────────────────────────────────────────────────────────────┘
```

- **Hero color** ocupa ~30% viewport. Verde `bg-emerald-600/20 border-emerald-500`, amarillo `bg-amber-600/20 border-amber-500`, rojo `bg-rose-700/20 border-rose-500`. Dark theme exclusivo.
- Hero NO usa shadcn Badge variants — custom className por instrucción CLAUDE.md.
- Lista flags = card list, hover bg, click abre drawer.
- "Compartir con cliente" genera link público read-only, expira 30d.
- Snapshot PDF firmado digitalmente + hash → archivable al cerrar venta (ver §8).

---

## 5. Drawer detalle por flag

Click en flag → side drawer (shadcn `Sheet` desde la derecha, ancho 540px desktop / fullscreen mobile). Progressive disclosure NN/G — info en capas.

```
┌─────────────────────────────────────────────┐
│ 🟡 Hipoteca BancoEstado sin alzar       ✕  │
├─────────────────────────────────────────────┤
│ ¿Qué es?                                    │
│   Banco recibió pago último dividendo pero  │
│   nunca inscribió la cancelación al margen  │
│   de la inscripción hipotecaria. La hipo-   │
│   teca queda viva en el registro aunque la  │
│   deuda esté pagada.                        │
│                                             │
│ Evidencia                                   │
│   • CGP CBR Santiago                        │
│     Foja 12345 Nº 6789 año 2003            │
│     [ ⬇ ver PDF original ]                 │
│   • Cruce SBIF: BancoEstado activo          │
│     [ 🔗 fuente ]                           │
│                                             │
│ Cómo se remedia                             │
│   1. Cliente pide carta cancelación al     │
│      BancoEstado (gratis si vigente).      │
│   2. Notario protocoliza la escritura.     │
│   3. CBR inscribe alzamiento al margen.    │
│                                             │
│ Tiempo y costo                              │
│   ⏱ 7-30 días        💰 $30k - $300k       │
│                                             │
│ ¿Quién lo hace?                             │
│   ( ) Cliente solo                          │
│   (•) Inmobiliaria gestiona                 │
│   ( ) Abogado aliado                        │
│                                             │
│ [ 📨 Crear ticket abogado ]                │
│ [ ✓ Marcar como resuelto ]                 │
└─────────────────────────────────────────────┘
```

- Tono español Chile no neutro. Términos legales **no traducir** (foja, dominio vigente, gravámenes y prohibiciones, posesión efectiva).
- "Crear ticket abogado" → modal con select abogado aliado del marketplace + campo nota + submit. Notifica a abogado vía pipeline notifications PropOS existente (push + email).
- "Marcar resuelto" requiere confirm + permite adjuntar evidencia (PDF carta cancelación, etc.). Reduce status del flag a 🟢 con badge "saneado".
- Drawer trae tab secundaria "Historial" con audit log (quién marcó qué cuándo, vía `v_entity_timeline`).

---

## 6. Dashboard portfolio inmobiliaria

Ruta `/admin/title-safeguard/dashboard`. Solo manager/admin. Desktop-first.

```
┌─────────────────────────────────────────────────────────────────────┐
│ Título Safeguard · Portfolio                Período: ▾ últimos 30d  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │ Listings │ │  Verde   │ │ Amarillo │ │   Rojo   │               │
│  │   142    │ │ 88 (62%) │ │ 38 (27%) │ │ 16 (11%) │               │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘               │
│                                                                     │
│  Distribución portfolio (donut)         Tiempo medio resolución     │
│  ┌────────────────────────┐             ┌────────────────────────┐ │
│  │   🟢 ████████ 62%      │             │ 🟡 → 🟢: 14 días prom │ │
│  │   🟡 █████ 27%         │             │ 🔴 → 🟢: 47 días prom │ │
│  │   🔴 ██ 11%            │             │ Tasa rechazo: 3.2%    │ │
│  └────────────────────────┘             └────────────────────────┘ │
│                                                                     │
│  Performance por captador                                           │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ Captador         │ Listings │ % Verde │ % Rojo │ Tiempo→🟢 │   │
│  │ ───────────────────────────────────────────────────────────│   │
│  │ María Torres     │    34    │  74%    │   3%   │   9 días  │   │
│  │ Pedro Núñez      │    28    │  61%    │   7%   │  16 días  │   │
│  │ Ana Vega         │    19    │  42%    │  21%  ⚠│  31 días  │   │ ← outlier rojo
│  └────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Banderas top                                                       │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ 1. Hipoteca sin alzar         42 ocurrencias               │   │
│  │ 2. Recepción final DOM        31                           │   │
│  │ 3. Sucesión sin PE            19                           │   │
│  └────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

- Filtro top: período (7/30/90/YTD), captador, comuna, estado.
- Comparativa captador en tabla — color amarillo cuando %Rojo > p75 del equipo. Fila clickable → vista filtrada por captador.
- Donut + KPI cards arriba. Recharts. `chart-config.ts` (preservar manualmente, ver gitignore caveat CLAUDE.md).
- Empty state si <5 listings: "Aún no hay datos suficientes. Levanta tu primera propiedad."
- Skeleton loader durante fetch, error con retry button (shadcn Empty + AlertCircle pattern).

---

## 7. Notificaciones

Reusa pipeline `notifications` existente PropOS (`backend/app/features/notifications/`). 4 canales: push (PWA web push existente), email, Slack workspace inmobiliaria, WhatsApp via Kapso (`notifications/whatsapp/dispatcher.py`).

| Trigger | Audiencia | Canal | Ejemplo |
|---------|-----------|-------|---------|
| Safeguard sync completa | captador | push | "Apoquindo 4500: 🟡 amarillo. 2 banderas." |
| CBR async listo | captador | push + email | "CGP recibido. Resultado actualizado." |
| 🔴 Red flag detectado | captador + manager | push + Slack | "🚨 Apoquindo 4500: red flag — embargo activo." |
| Ticket abogado abierto | abogado | email + push | "Nuevo ticket: hipoteca sin alzar — Apoquindo 4500." |
| Cliente recibe link | cliente final | email + WhatsApp | "Tu propiedad: estado legal listo. Ver detalle." |
| GP venció >30d | captador | push recordatorio | "El CGP de Apoquindo 4500 venció. Refresca." |

Reglas (Slack/Smashing patterns):
- **No spam**. Defaults conservadores. User control en `/admin/settings/notifications` para silenciar por categoría.
- **Throttle**. >5 listings procesados → digest único en lugar de N pushes.
- **Quiet hours** 22:00-08:00 hora Chile (`America/Santiago`).
- **Manager Slack** solo para 🔴, no para amarillos (saturación).

GP-vencimiento es feature crítica: certificado CBR vale 30 días. Cron job diario, listing pasa de `verde verificado` a `verde stale` con badge "verificación expirada" hasta refresh.

---

## 8. Integración con flow venta PropOS

Title Safeguard es ciudadano de primer orden del CRM, no módulo aislado.

### 8.1. Property card en CRM

```
┌──────────────────────────────────────────────────────┐
│ 📷 [foto]   Av. Apoquindo 4500              🟡       │ ← badge safeguard
│             Las Condes · 3D 2B · 80 m²              │
│             UF 6.500                                │
│             Captador: María T.   Hace 2 días        │
└──────────────────────────────────────────────────────┘
```

- Badge `🟢 🟡 🔴` esquina superior derecha card. Tooltip hover = "Estudio de título: [estado] · click para detalle".
- Filtro lateral CRM: "Mostrar solo verdes" toggle. Default: todos.

### 8.2. Bloqueo publicación

- **No se puede publicar (push a portales: Portal Inmobiliario, Yapo, etc.) sin 🟢 o 🟡 con override manager**.
- 🔴 = botón "Publicar" deshabilitado, tooltip "Resuelve banderas rojas para publicar" + link al detalle.
- 🟡 → manager puede override con motivo (capturado en audit). Captador solo NO puede override.
- Override despliega Dialog con confirmación + textarea motivo + checkbox "entiendo que asumo el riesgo legal".

### 8.3. Snapshot al cerrar venta

- Al marcar property como `sold` (transición de status), backend dispara job `snapshot_title_safeguard`:
  - Genera PDF con todo: hero, flags, evidencias, audit log, recomendaciones.
  - Hash SHA-256 + timestamp + storage Supabase bucket inmutable (`storage/safeguard_snapshots`).
  - Adjunto al `property.closure_documents` jsonb.
  - Visible en timeline `/admin/timeline/properties/<id>` (feature ya existe vía Anita).

Funciona como prueba de due diligence si comprador disputa post-venta.

---

## 9. Edge cases UX

### 9.1. Documento baja calidad

- Vision LLM retorna `confidence < 0.6` en >2 campos → bloquea Step 3, pide retomar foto.
- Mensaje: "La foto está borrosa o el documento está cortado. Vuelve a tomarla con buena luz."
- Botón "Continuar igualmente" oculto detrás de "Avanzado" (escape hatch).

### 9.2. CBR cae

- Scraper CBR timeout (>5 min) → retry automático 3x con backoff exponencial.
- Falla persistente → flag amarillo informativo "🟡 CBR no disponible — reintenta en 1h. Resultado parcial mostrado."
- Status durable en `safeguard_jobs` table, worker resume al volver online.
- Manager dashboard expone "Disponibilidad CBR última 7d" como widget operacional.

### 9.3. Sin dirección exacta — busca por RUT

- Si Google Places no resuelve dirección rural sin nomenclatura clara, fallback a búsqueda CBR por RUT titular.
- Modal: "No encontramos dirección. Buscamos por RUT del titular en CBRs aledaños."
- Devuelve N candidatos, captador elige.

### 9.4. Propietario muerto — flow especial PE primero

- Si Registro Civil retorna defunción del titular activo CBR → safeguard pivota a "modo sucesión".
- Pantalla intermedia: "El titular figura como fallecido. Antes del estudio de título completo, necesitamos verificar la posesión efectiva."
- Sub-flow: pide al captador subir resolución PE (si existe) o se marca el listing 🟡 con bandera #4 ("Sucesión sin posesión efectiva tramitada", ver `06-casos-tipicos-y-flags.md`).
- Recomendación PropOS automática: "Antes de captar mandato, asegúrate de que herederos tramitaron PE. Estimado 30-90 días si intestada."

### 9.5. Abogado externo permisos diferentes

- Rol `lawyer` en sidebar ve `/lawyer/inbox-tickets` + `/lawyer/case/<id>`.
- Permisos RLS: read-only sobre `safeguard_studies` + `flags` + `evidence_files` solo de tickets que le fueron asignados.
- Write: solo en `lawyer_notes` + `lawyer_recommendation` + transición de estados del ticket (`open`, `in_review`, `resolved`, `escalated`).
- No ve dashboard portfolio. No ve otros listings. No ve datos comerciales (precio, comisión).

---

## 10. i18n + UI Spanish (regla CLAUDE.md)

- Rutas/modelos/archivos/comentarios → **English**: `/admin/title-safeguard`, `safeguard_studies`, `flags.severity`, comentarios `// fetch CBR async job`, log msgs `"safeguard_job_completed"`.
- Strings UI → **Spanish Chile no neutro**: "Iniciar safeguard", "Vendible con remediación", "Compartir con cliente". No "te ofrezco", sí "puedes" y voseo NO (Chile usa tú).
- **Términos legales NO traducir**: foja, número, año, dominio vigente, gravámenes y prohibiciones, posesión efectiva, inscripción especial herencia, certificado de gravámenes, cabida, deslindes, Ley 20.898 ("Ley del Mono"). Mantener mayúsculas oficiales.
- Tooltips para cada término técnico (ver §13 onboarding).
- LLM prompts del Client Agent (B2C) producen output en español Chile (regla CLAUDE.md Anita/Kapso).

---

## 11. Mobile / PWA

- **Captura cámara nativa**: input HTML `<input type="file" accept="image/*,application/pdf" capture="environment">`. PWA con permiso Camera API getUserMedia para capturas avanzadas (auto-crop perspective, multi-página).
- **Auto-crop**: model client-side (Dynamsoft o equivalente WASM) endereza foto skewed, recorta bordes blancos. Mejora confidence vision LLM ~15pp según benchmarks.
- **Offline first**: form puede llenarse offline. Foto se guarda en IndexedDB. Al volver online, dispatch job. Service worker sync (recordar: SW disabled en dev por HMR, regla CLAUDE.md `vite.config.ts`).
- **Touch targets** ≥44px. Drawer fullscreen mobile (no side sheet).
- **Hero color** mobile ocupa 100% viewport hasta scroll.
- **Push notification** vía web push API existente. Click → deep link a detalle propiedad.

---

## 12. Onboarding

Primera vez que captador entra a `/admin/title-safeguard`:

```
┌──────────────────────────────────────────────┐
│  👋  Conoce Title Safeguard           1 / 4  │
│                                              │
│  Detectamos problemas legales antes de que   │
│  cuesten ventas. CBR + SII + DOM + abogado.  │
│                                              │
│  [ Saltar tour ]            [ Siguiente → ]  │
└──────────────────────────────────────────────┘
```

- **Tour 4 pasos máx** (research SaaS: 3-5 ideal). Tooltips action-driven sobre UI real.
  1. Welcome.
  2. "Pulsa aquí para ingresar propiedad" → highlight botón nuevo.
  3. Demo: propiedad ficticia red flag pre-cargada → click la abre, drawer expandido en flag #15 (embargo).
  4. "Revisa tu dashboard" → highlight tab portfolio.
- **Skip prominente**. Persistencia: `profiles.onboarding_state.title_safeguard = 'completed' | 'skipped'`.
- **Tooltips persistentes** (no onboarding) sobre términos legales: hover "foja" → tooltip "Página del libro CBR donde está inscrita la propiedad." Componente shadcn `<Tooltip>` reusado.
- **Demo property** seedeada en account de prueba (`is_demo=true`), no contamina dashboard real.

---

## 13. Métricas producto

Eventos a trackear (Mixpanel/PostHog/internal `analytics_events`):

| Métrica | Definición | Target |
|---------|-----------|--------|
| **Activación** | % users que completan 1er safeguard <7d desde signup | >70% |
| **Adoption** | % listings nuevos con safeguard ejecutado | >85% en 90d |
| **Tiempo end-to-end** | mediana min desde click "Nueva propiedad" hasta semáforo definitivo (excluyendo CBR async) | <90s |
| **Conversion red→fixed** | % flags 🔴 que pasan a 🟢 dentro 60d | >40% |
| **NPS broker** | NPS específico feature, encuesta in-app post 5to safeguard | >40 |
| **Latencia scraper p95** | p95 tiempo respuesta SII/TGR/DGA/DOM | <30s |
| **Disponibilidad CBR** | uptime scraper CBR | >97% |
| **Tasa override 🟡** | manager overrides / total amarillos | <15% (alto = falsos positivos) |
| **Falsos positivos** | flags marcados "no aplica" / total flags | <8% |

Eventos atómicos: `safeguard_started`, `safeguard_completed`, `flag_drawer_opened`, `lawyer_ticket_created`, `flag_resolved`, `share_link_generated`, `snapshot_pdf_downloaded`.

Dashboard interno `/admin/analytics/title-safeguard` para PM. Reusa pattern de `/admin/analytics/anita-cost` (regla CLAUDE.md).

---

## 14. Pricing UX

Decisión: feature **flat-included en seat broker** + costos variables transparentes per-study cuando aplican (ej. ticket abogado, certificado CBR pagado).

```
┌──────────────────────────────────────────────────────┐
│  Resumen costos · Apoquindo 4500                     │
├──────────────────────────────────────────────────────┤
│  Estudio automatizado          incluido en plan      │
│  Certificado CGP CBR           $3.500   (te lo cobra│
│                                          CBR Stgo)  │
│  Ticket abogado aliado         $80.000  (opcional)  │
│  ──────────────────────────────────────────────────  │
│  Total estimado                $83.500               │
└──────────────────────────────────────────────────────┘
```

- **Transparencia siempre**. Estimado antes de gatillar costo. Confirmación explícita previa a cargo (Stripe/Mercado Pago intent).
- Costos pasados a través al cliente final si así pacta inmobiliaria → UI permite split (campo "¿Quién paga?": inmobiliaria | cliente | dividido).
- No hay "premium tier" que esconda flags. Todos los flags visibles. Solo upsell = ticket abogado (curado) y refresh acelerado CBR.
- Página `/admin/billing/safeguard` con histórico, factura mensual.

---

## 15. Referencias UX research

Patrones tomados/inspirados:
- **Progressive disclosure** (NN/G, Mirakl Design): drawer flag, jerga legal en capas.
- **Async job UI** (PatternFly progress stepper, Hangfire docs): step 4 ingesta, status durable.
- **Inline OCR + confidence scoring** (Veryfi, Mindee): step 3 confirmación FNA.
- **Slack notifications flowchart**: throttle, quiet hours, digest.
- **shadcn Empty + Skeleton patterns**: empty state dashboard, retry on error.
- **Propy digital closing dashboard**: snapshot inmutable post-venta.
- **Onboarding tours** (Userpilot, Appcues, Chameleon): 4 pasos action-driven.

---

## 16. Recomendaciones UX (5)

1. **Hero semáforo dominante**. Veredicto único `🟢 🟡 🔴` ocupa el primer pliegue de la pantalla. Captador y cliente final entienden en <2s. Toda la jerga legal queda detrás de drawers/tooltips. Validar usabilidad con 5 captadores reales antes de lanzar — si tardan >5s en interpretar el hero, rediseñar.

2. **Async first-class, no opcional**. Step 4 muestra "puedes cerrar esta pantalla" en negrita. Push notification al volver. CBR ETA visible siempre. Trata partial success como ciudadano de primer orden — render resultado parcial sin esperar CBR. Captador en terreno no puede esperar 60s parado frente al cliente.

3. **Drawer 5-secciones canónico** (`Qué es / Evidencia / Cómo se remedia / Tiempo y costo / Quién`). Misma estructura para los 30+ flags. Reduce carga cognitiva, permite muscle memory, simplifica i18n. Componente `<FlagDrawer flag={flag} />` único, content-driven.

4. **Bloqueo publicación con escape válido**. 🔴 bloquea con tooltip explicativo, NO permite override silencioso. 🟡 permite override solo manager + razón obligatoria + audit. Frontend rendering (`<PublishButton property={p} />`) lee el veredicto y decide disable/enable. Backend valida igual al PUT — nunca confiar solo en UI.

5. **Transparencia costos antes de cobro**. Cada acción que dispara cargo (ticket abogado, certificado pagado, refresh acelerado) muestra modal con monto exacto + quién paga + Stripe intent. Cero cobros sorpresa. Métrica: tasa de abandono en confirm-pay debe ser <10% — si es mayor, los precios o el copy fallan.

---

## 17. User stories (3)

### Story A — Captador en terreno

> **Como** captador parado en la cocina de la dueña con su iPhone,
> **quiero** sacar foto de la escritura y ver en menos de 90 segundos si la propiedad es vendible,
> **para** decidir si firmo mandato hoy o me ahorro 2 semanas perdidas en una casa con embargo.
>
> Acceptance: PWA funciona en LTE, vision LLM extrae FNA con conf >0.8 en 90% fotos legibles, semáforo aparece en p95 <90s excluyendo CBR async, push notification cuando CBR resuelve.

### Story B — Manager pipeline review

> **Como** manager de inmobiliaria con 6 captadores y 142 listings activos,
> **quiero** ver en una pantalla qué % de mi portfolio es publicable y qué captador trae más basura legal,
> **para** coachear o reasignar antes de quemar mes en listings que jamás cerrarán.
>
> Acceptance: dashboard `/admin/title-safeguard/dashboard` carga en <2s con 1000 listings, comparativa captador con outliers resaltados, drill-down clickable, export CSV para reunión semanal.

### Story C — Cliente final propietario

> **Como** dueña de la casa que la inmobiliaria está captando,
> **quiero** entender en español simple por WhatsApp qué pasa con mi propiedad y cuánto cuesta arreglarlo,
> **para** confiar en la inmobiliaria y no sentir que me están ocultando algo o cobrando de más.
>
> Acceptance: link público read-only enviado por WhatsApp/email, vista mobile fullscreen sin sidebar, hero semáforo + 1 párrafo de explicación + costo total estimado + CTA "Hablar con mi captador". Cero login. Expira 30d. Tooltip por término legal.

---

**Fin documento 18**. Siguientes documentos sugeridos: `19-pricing-economics-deep.md`, `20-data-model-ddl.md`, `21-rollout-plan-90d.md`.

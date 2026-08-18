# Sub-encargados y Cláusulas Contractuales (DPA + SCC)

> Ley N° 21.719, Art. 27 — transferencias internacionales. PropOS contrata los siguientes sub-encargados para procesar datos por cuenta de los responsables (CETER, ANAIDA). Versión 1.2 — 2026-08-16 (la v1.1 corrigió el estado de Groq; esta agrega el kill switch que la v1.1 declaraba inexistente).

## Estrategia

Aceptamos los DPA + SCC publicados por cada proveedor. No negociamos contratos individuales (capacidad fuera de alcance para PYME). Mantener este archivo actualizado cuando se agregue, cambie o quite un sub-encargado.

## Tabla de sub-encargados

| Proveedor | Servicio | País | DPA / SCC | Datos procesados |
|---|---|---|---|---|
| Supabase Inc. | Postgres + Auth + Storage | US | https://supabase.com/legal/dpa | Toda la base de datos del producto |
| Vercel Inc. | Hosting frontend | US | https://vercel.com/legal/dpa | Logs de acceso al sitio |
| Google Cloud (GCP) | Hosting backend (Cloud Run) | US | https://cloud.google.com/terms/data-processing-addendum | Tráfico HTTP, logs |
| Groq Inc. | **LLM + STT Whisper — ACTIVO, único proveedor de IA en uso** | US | https://groq.com/privacy-policy/ (**DPA pendiente — bloqueante**) | Prompts, respuestas y audios del asistente (Propo/agent) y del Client Agent de WhatsApp |
| Anthropic PBC | LLM (Claude) — planificado, **no en uso** | US | https://www.anthropic.com/legal/dpa | Ninguno hoy; el swap de proveedor quedó diferido post-v0.1.0 |
| Cerebras Systems | LLM — planificado, **no en uso** | US | https://www.cerebras.ai/privacy (verificar DPA explícito antes de usar) | Ninguno hoy |
| Kapso | BSP de WhatsApp Business | Internacional | DPA bilateral pendiente. Verificar antes de activar broadcast | Mensajes WhatsApp, números de teléfono |
| Resend | Email transaccional | US | https://resend.com/legal/dpa | Emails enviados, direcciones destinatarias |
| OpenAI (futuro) | Posible LLM alternativo | US | https://openai.com/policies/data-processing-addendum/ | Solo si se activa |

## Acciones pendientes

Checklist por vendor — marcar cuando se acepte/archive el DPA. Evidencia (screenshot del dashboard o email de confirmación) en `docs/compliance/dpa-evidence/<vendor>.{png,eml}` (gitignored si contiene PII).

- [ ] **Supabase** — Dashboard → Organization → Settings → Legal → Accept DPA.
- [ ] **Vercel** — Team Settings → Legal → Data Processing Agreement.
- [ ] **Google Cloud (GCP)** — IAM & Admin → Settings → Data Processing Addendum.
- [ ] **Anthropic** — Console → Settings → Privacy → DPA.
- [ ] **Resend** — Dashboard → Settings → Legal → DPA.
- [ ] **Cerebras** — No expone DPA en dashboard; enviar email a `legal@cerebras.ai` solicitando DPA estándar. Archivar respuesta. Requerido **solo si** se activa Cerebras (hoy sin uso).
- [ ] **Groq — BLOQUEANTE.** Solicitar DPA estándar a `legal@groq.com` y archivar respuesta. Groq ya procesa el 100% de los prompts y audios en producción, así que este DPA está vencido de hecho: obtenerlo antes de cargar datos reales de clientes. Mientras no esté firmado, la mitigación es el kill switch `AI_PROCESSING_ENABLED` (ver más abajo); si se cargan datos reales de clientes antes de la firma, ponerlo en `false`.
- [ ] **Kapso** — Verificar DPA bilateral en contrato BSP existente; si falta, solicitar a contacto comercial. Requerido antes de habilitar `WHATSAPP_BROADCAST_ENABLED=true`.

## Estado real de la IA (verificado 2026-08-16)

El código llama a `https://api.groq.com/openai/v1` de forma fija en cinco
lugares: `agent/classifier.py`, `agent/tools/text_to_sql.py`,
`agent/transcribe.py`, `properties/describe.py` y `channels/client_agent.py`.
`settings.agent_provider` solo elige la ventana de rate-limit, no el proveedor.
Cualquier cambio de proveedor debe actualizar esta tabla y `rat.yaml` **antes**
del despliegue.

### Kill switch `AI_PROCESSING_ENABLED`

Existe desde 2026-08-16 (`backend/app/core/ai_guard.py`, `settings.ai_processing_enabled`).

- **Qué hace.** `assert_ai_processing_enabled()` corta la llamada al
  sub-encargado y devuelve `503` con un detalle explícito. Falla ruidosamente a
  propósito: un corte silencioso se le presentaría al corredor como "consulté la
  base y no hay resultados", que es una respuesta falsa, no una degradación.
- **Cómo se acciona.** Variable de entorno `AI_PROCESSING_ENABLED=false` en el
  servicio de Cloud Run. Es un cambio de configuración, no un despliegue de
  código: no hay que rebuildear ni revertir commits. Vuelve a `true` para
  reactivar. Default `true`.
- **Cuándo accionarlo.** (a) si Groq no firma el DPA y hay que cargar datos
  reales de clientes; (b) ante un incidente de seguridad del proveedor; (c) si
  la APDP requiere detener la transferencia internacional.
- **Qué NO cubre.** Es un corte de la transferencia hacia adelante. No borra lo
  ya enviado ni las transcripciones ya persistidas — eso lo hace el sweep de
  retención (`compliance/service.py::run_retention_sweep`, 90 días).
- **Pendiente de cableado.** El flag y su guard existen y están cubiertos por
  tests, pero las cinco llamadas a Groq todavía no lo invocan: `features/agent/**`
  y `features/channels/**` son de otro carril. Hasta que llamen a
  `assert_ai_processing_enabled()`, el único corte efectivo sigue siendo
  desetear `GROQ_API_KEY`.

## Política de cambio

Cuando se agregue un sub-encargado:

1. Actualizar esta tabla.
2. Verificar DPA + SCC publicados.
3. Actualizar `rat.yaml` con el nuevo destinatario.
4. Actualizar `privacy-policy.md` sección 5.
5. Si el cambio es relevante (categoría de datos nueva o destino nuevo), notificar a titulares con consentimiento activo.

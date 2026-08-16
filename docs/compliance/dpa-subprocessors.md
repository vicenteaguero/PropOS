# Sub-encargados y Cláusulas Contractuales (DPA + SCC)

> Ley N° 21.719, Art. 27 — transferencias internacionales. PropOS contrata los siguientes sub-encargados para procesar datos por cuenta de los responsables (CETER, ANAIDA). Versión 1.1 — 2026-07-02 (corrige el estado de Groq: la v1.0 lo declaraba deshabilitado siendo el único proveedor de IA en uso).

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
- [ ] **Groq — BLOQUEANTE.** Solicitar DPA estándar a `legal@groq.com` y archivar respuesta. Groq ya procesa el 100% de los prompts y audios en producción, así que este DPA está vencido de hecho: obtenerlo antes de cargar datos reales de clientes, o gatear el STT/LLM tras un flag apagado mientras tanto (ese flag hoy **no existe** en el código).
- [ ] **Kapso** — Verificar DPA bilateral en contrato BSP existente; si falta, solicitar a contacto comercial. Requerido antes de habilitar `WHATSAPP_BROADCAST_ENABLED=true`.

## Estado real de la IA (verificado 2026-07-02)

El código llama a `https://api.groq.com/openai/v1` de forma fija en
`agent/classifier.py`, `agent/tools/text_to_sql.py` y `agent/transcribe.py`.
`settings.agent_provider` solo elige la ventana de rate-limit, no el proveedor.
No hay flag que apague el STT. Cualquier cambio de proveedor debe actualizar
esta tabla y `rat.yaml` **antes** del despliegue.

## Política de cambio

Cuando se agregue un sub-encargado:

1. Actualizar esta tabla.
2. Verificar DPA + SCC publicados.
3. Actualizar `rat.yaml` con el nuevo destinatario.
4. Actualizar `privacy-policy.md` sección 5.
5. Si el cambio es relevante (categoría de datos nueva o destino nuevo), notificar a titulares con consentimiento activo.

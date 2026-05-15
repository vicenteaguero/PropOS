# Sub-encargados y Cláusulas Contractuales (DPA + SCC)

> Ley N° 21.719, Art. 27 — transferencias internacionales. PropOS contrata los siguientes sub-encargados para procesar datos por cuenta de los responsables (CETER, ANAIDA). Versión 1.0 — 2026-05-10.

## Estrategia

Aceptamos los DPA + SCC publicados por cada proveedor. No negociamos contratos individuales (capacidad fuera de alcance para PYME). Mantener este archivo actualizado cuando se agregue, cambie o quite un sub-encargado.

## Tabla de sub-encargados

| Proveedor | Servicio | País | DPA / SCC | Datos procesados |
|---|---|---|---|---|
| Supabase Inc. | Postgres + Auth + Storage | US | https://supabase.com/legal/dpa | Toda la base de datos del producto |
| Vercel Inc. | Hosting frontend | US | https://vercel.com/legal/dpa | Logs de acceso al sitio |
| Google Cloud (GCP) | Hosting backend (Cloud Run) | US | https://cloud.google.com/terms/data-processing-addendum | Tráfico HTTP, logs |
| Anthropic PBC | LLM (Claude) — Anita producción | US | https://www.anthropic.com/legal/dpa | Prompts y respuestas de Anita |
| Cerebras Systems | LLM — Anita desarrollo | US | https://www.cerebras.ai/privacy (verificar DPA explícito antes de prod) | Prompts y respuestas de Anita en dev |
| Groq Inc. | STT Whisper — actualmente DESHABILITADO | US | https://groq.com/privacy-policy/ (DPA pendiente) | Audios — cuando se reactive |
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
- [ ] **Cerebras** — No expone DPA en dashboard; enviar email a `legal@cerebras.ai` solicitando DPA estándar. Archivar respuesta. Requerido antes de pasar Anita a producción con su modelo.
- [ ] **Groq** — Idem `legal@groq.com`. Requerido antes de reactivar `ANITA_STT_ENABLED=true`.
- [ ] **Kapso** — Verificar DPA bilateral en contrato BSP existente; si falta, solicitar a contacto comercial. Requerido antes de habilitar `WHATSAPP_BROADCAST_ENABLED=true`.

## Política de cambio

Cuando se agregue un sub-encargado:

1. Actualizar esta tabla.
2. Verificar DPA + SCC publicados.
3. Actualizar `rat.yaml` con el nuevo destinatario.
4. Actualizar `privacy-policy.md` sección 5.
5. Si el cambio es relevante (categoría de datos nueva o destino nuevo), notificar a titulares con consentimiento activo.

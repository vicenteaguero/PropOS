# Procedimiento manual de Solicitud de Derechos (DSAR)

> Ley N° 21.719, Arts. 14–15. Plazo legal: **30 días corridos** desde recepción, prorrogable 30 días más con aviso al titular. Procedimiento manual — no hay portal automatizado en v3. Versión 2.0 — 2026-08-16.
>
> **Cambios v1.0 → v2.0.** La v1.0 nunca se ejecutó contra el esquema real y sus tres comandos principales fallaban: consultaba una tabla `people` que no existe (la tabla del CRM es `contacts`), llamaba a `/admin/people/<id>/export` (la ruta real es `/admin/compliance/contacts/{contact_id}/export`) y actualizaba `media_files.owner_id`, columna que no existe. Todo lo de abajo está alineado con el esquema y la API vigentes.

## 1. Llega un email a `privacidad@propos.cl`

Trigger: alguien escribe pidiendo acceso, rectificación, cancelación, oposición, portabilidad o bloqueo de sus datos.

## 2. Verificación de identidad (obligatorio antes de actuar)

**Email-loop manual** — pedir al solicitante que responda al email **registrado en nuestra base** (no necesariamente al que envió el mensaje original):

```
Hola [Nombre],

Recibimos tu solicitud para [acceder a / rectificar / borrar / etc.] tus datos personales.

Para confirmar tu identidad y proteger tus datos, te pedimos responder a este email
desde la dirección que tenemos registrada: [email registrado].

Si ya no tienes acceso a ese email, escríbenos describiendo:
- Última propiedad que consultaste con nosotros (aproximadamente).
- Mes y año aproximado de tu primer contacto.
- Nombre del corredor que te atendió, si lo recuerdas.

Y/o adjunta una foto clara de tu cédula vigente y un selfie sosteniendo la cédula.

Plazo de respuesta: el plazo legal de 30 días para responder a tu solicitud comienza
una vez verifiquemos tu identidad.

Saludos,
[Nombre]
```

**Si el email coincide y responde con éxito**: identidad verificada.

**Si no coincide**: pedir 2-3 datos del historial (no datos públicos como RUT). Si no recuerda, pedir cédula + selfie y revisar visualmente.

## 3. Buscar al titular en la base

La tabla del CRM es `contacts`. No existe ninguna tabla `people`; lo que sí existe es `person_aliases`, que guarda los nombres alternativos con los que el asistente reconoce al titular.

```sql
-- Reemplazar :rut o :email
SELECT id, full_name, email, rut, tenant_id, created_at, deleted_at, erased_at
FROM contacts
WHERE rut = :rut OR email = :email;

-- El titular puede estar registrado con otro nombre; buscar también por alias.
SELECT c.id, c.full_name, c.email, a.alias
FROM person_aliases a
JOIN contacts c ON c.id = a.person_id
WHERE a.alias ILIKE :nombre;
```

Si hay múltiples coincidencias, exigir más datos antes de actuar. Si la fila trae `erased_at` no nulo, el titular ya ejerció supresión: es un tombstone sin datos personales y no hay nada que entregar ni que borrar de nuevo.

Ejecutar con `make query SQL="..."` (ver `CLAUDE.md` § DB para el fallback cuando el atajo está roto).

## 4. Ejecutar el derecho

### Acceso / Portabilidad

```bash
# ADMIN-only. El titular debe vivir en el tenant activo; para otro tenant,
# cambiar el X-Tenant-Id.
curl -H "Authorization: Bearer <admin-token>" \
     -H "X-Tenant-Id: <tenant>" \
     https://<api>/admin/compliance/contacts/<contact_id>/export \
     -o export-<contact_id>.json
```

El bundle incluye: la fila del contacto, el estado de consentimiento con su evidencia, alias, interacciones y sus targets, notas, tareas, las conversaciones y mensajes de WhatsApp del titular (`client_conversations` / `client_messages`), los consentimientos por canal (`client_consents`), los emails vinculados (`email_messages`) y las transcripciones de audio con sus `media_files` alcanzables.

Enviar al titular por email cifrado o link efímero. Conservar copia del export en `docs/internal-plans/dsar-YYYY-MM-DD-<id>.json` (gitignored) durante 5 años como evidencia.

### Rectificación

Editar los campos del contacto desde la UI admin del CRM (`PATCH /contacts/{contact_id}`). El `audit_log` universal registra el cambio automáticamente.

### Cancelación / Supresión

La supresión **no** es el soft delete del CRM. `DELETE /contacts/{contact_id}` solo marca `deleted_at` y conserva íntegros el RUT, el teléfono y el email — sirve para ordenar la bandeja, no para responder un Art. 14.

La supresión real es `ComplianceService.erase_subject(contact_id, tenant_id, reason=...)` (`backend/app/features/compliance/service.py`), que en un solo paso:

1. Convierte el contacto en tombstone: sobrescribe nombre, email, teléfono, RUT, fecha de nacimiento, dirección, notas y metadata, y estampa `erased_at`. Sobreviven `id` y `tenant_id` para que las FK que apuntan al contacto sigan siendo válidas.
2. Borra sus `person_aliases`.
3. Programa la purga de los `media_files` alcanzables desde sus interacciones (`interactions.raw_transcript_id → agent_transcripts.media_file_id`, el único vínculo contacto↔media que existe en el esquema) con 30 días de gracia.
4. **Redacta** los snapshots de `audit_log`: reemplaza los campos con datos personales por `"[redacted]"` sin borrar ninguna fila, así el ledger sigue siendo append-only y auditable.

> **Pendiente de cableado:** todavía no hay una ruta HTTP que la exponga (`compliance/router.py` no la publica) ni un job de retención que ejecute la purga programada. Hasta que estén, invocarla desde una consola del backend y correr `run_retention_sweep()` a mano; ambos pasos quedan registrados en `audit_log`.

Si hay obligación de retención (factura SII, contrato vigente): explicar al titular que los datos quedan **bloqueados** (sin uso comercial) por X años, no borrados — ver "Bloqueo temporal".

### Oposición (a una finalidad específica)

Vía API, que es lo que además deja la traza:

```bash
curl -X DELETE \
     -H "Authorization: Bearer <admin-token>" \
     -H "X-Tenant-Id: <tenant>" \
     -H "Content-Type: application/json" \
     -d '{"purposes": ["marketing"]}' \
     https://<api>/compliance/contacts/<contact_id>/consent
```

Quita esa finalidad de `contacts.consent.purposes`; si no queda ninguna, además estampa `revoked_at`. Omitir `purposes` (o mandar `null`) revoca el consentimiento completo.

Finalidades reconocidas por el gate: `operacional`, `marketing`, `email`, `whatsapp`. Las tres últimas requieren consentimiento — sin registro vigente, el envío se rechaza.

El opt-out de WhatsApp vive en una tabla distinta (`client_consents`, por canal) y se ejerce con `DELETE /client-chat/consents/{contact_id}?channel=whatsapp`.

### Bloqueo temporal

No hay endpoint dedicado todavía; se escribe directo:

```sql
UPDATE contacts
SET consent = jsonb_set(coalesce(consent, '{}'::jsonb), '{blocked_at}', to_jsonb(now()))
WHERE id = :contact_id AND tenant_id = :tenant_id;
```

El bloqueo **sí** tiene efecto técnico: `evaluate_consent` lo antepone a cualquier consentimiento vigente y detiene todas las finalidades, incluida la operacional. Para levantarlo, poner `blocked_at` en `null`.

### Decisión automatizada

PropOS no toma decisiones con efectos jurídicos sobre el titular, pero **sí ejecuta acciones sin aprobación humana**: 10 de los 12 intents del asistente tienen `auto_commit=True` y escriben directo en el CRM (crear contacto, registrar interacción, crear tarea, nota, evento, propiedad, campaña…). Solo `update_person` y `log_transaction` pasan por `pending_proposals` con revisión humana.

Responder al titular con ese detalle — no con la frase "todo lo aprueba una persona", que no es cierta. Toda escritura del asistente queda en `audit_log` con `source='agent'` y su `agent_session_id`, así que es reconstruible cuál acción fue automática.

## 5. Responder al titular

Plantilla de respuesta (acceso/portabilidad):

```
Hola [Nombre],

En respuesta a tu solicitud del [fecha], adjuntamos la información que tenemos registrada sobre ti:

[archivo JSON adjunto / link]

Esta información proviene de los siguientes tratamientos:
- [listar tratamientos del RAT relevantes].

Si detectas algún error, escríbenos para rectificarlo.

Saludos,
[Nombre]
```

## 6. Cerrar el caso

- Mover el email a carpeta `DSAR-resueltos/YYYY/`.
- Crear nota en `docs/internal-plans/dsar-YYYY-MM-DD-<id>.md` (gitignored): timeline, datos solicitante, derecho ejercido, acción tomada, evidencia.
- Conservar 5 años.

## 7. Casos especiales

| Caso | Manejo |
|---|---|
| Solicitud abusiva o repetida | Ley permite negar si "manifiestamente infundada o excesiva". Responder con justificación |
| Madre/padre pide datos de hijo menor | Pedir certificado de nacimiento + cédula del progenitor + cédula del menor |
| Heredero pide datos de fallecido | Pedir posesión efectiva. Verificar con abogado si llega: la ley NO da derechos automáticos a herederos |
| Borrado afecta a terceros | Anonimizar el nombre, conservar resto de la interacción |
| Pedido por WhatsApp directo | Redirigir a `privacidad@propos.cl`. Documentar fecha de WhatsApp como inicio del plazo |

## 8. Si no se puede responder en 30 días

Avisar al titular antes de que se cumpla el plazo:

```
Hola [Nombre],

Tu solicitud del [fecha] requiere análisis adicional. Conforme al Art. [X] de la
Ley 21.719, te informamos que extendemos el plazo de respuesta por 30 días adicionales,
hasta el [fecha + 60 días].

Si tienes preguntas, escríbenos.

Saludos
```

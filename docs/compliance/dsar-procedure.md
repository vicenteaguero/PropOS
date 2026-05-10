# Procedimiento manual de Solicitud de Derechos (DSAR)

> Ley N° 21.719, Arts. 14–15. Plazo legal: **30 días corridos** desde recepción, prorrogable 30 días más con aviso al titular. Procedimiento manual — no hay portal automatizado en v3. Versión 1.0 — 2026-05-10.

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

```sql
-- Reemplazar :rut o :email
SELECT id, full_name, email, rut, tenant_id, created_at
FROM people
WHERE rut = :rut OR email = :email;
```

Si hay múltiples coincidencias, exigir más datos antes de actuar.

## 4. Ejecutar el derecho

### Acceso / Portabilidad

```bash
# Endpoint backend
curl -H "Authorization: Bearer <admin-token>" \
     -H "X-Tenant-Id: <tenant>" \
     https://<api>/admin/people/<person_id>/export \
     -o export-<person_id>.json
```

Enviar al titular por email cifrado o link efímero. Conservar copia del export en `docs/internal-plans/dsar-YYYY-MM-DD-<id>.json` (gitignored) durante 5 años como evidencia.

### Rectificación

Editar campos directos en `people` desde la UI admin. El audit_log universal registra el cambio automáticamente.

### Cancelación / Supresión

```sql
-- Soft delete + programar purga real en 30 días
UPDATE people
SET deleted_at = now(),
    consent = jsonb_set(coalesce(consent, '{}'::jsonb), '{revoked_at}', to_jsonb(now()))
WHERE id = :person_id;

-- Si tienen documentos sensibles asociados:
UPDATE media_files
SET purge_after = now() + interval '30 days'
WHERE owner_id = :person_id;
```

Si hay obligación de retención (factura SII, contrato vigente): explicar al titular que los datos quedan **bloqueados** (sin uso comercial) por X años, no borrados.

### Oposición (a una finalidad específica)

```sql
UPDATE people
SET consent = jsonb_set(coalesce(consent, '{}'::jsonb), '{purposes}',
    (SELECT to_jsonb(array_remove(
        (consent->'purposes')::text[]::text[], :purpose
    )) FROM people WHERE id = :person_id))
WHERE id = :person_id;
```

Ejemplo `:purpose` = `"marketing"` o `"whatsapp_marketing"`.

### Bloqueo temporal

```sql
UPDATE people
SET consent = jsonb_set(coalesce(consent, '{}'::jsonb), '{blocked_at}', to_jsonb(now()))
WHERE id = :person_id;
```

Las consultas de marketing/notificaciones deben respetar este flag (a implementar cuando se conecten esas features).

### Decisión automatizada

PropOS no toma decisiones automatizadas — todas las propuestas de Anita pasan por `pending_proposals` con aprobación humana. Responder al titular confirmando este hecho.

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

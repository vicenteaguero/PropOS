# Cumplimiento Ley 21.719 (Chile) — Feature `documents`

> Documento interno. Resume gaps y acciones pendientes para que el módulo de gestión de documentos cumpla con la Ley 21.719 de Protección de Datos Personales (Chile, vigencia 2026).

## Contexto

La Ley 21.719 endurece estándares de tratamiento de datos personales: consentimiento explícito, retención acotada, derecho de acceso/rectificación/supresión (DSAR), notificación de brechas, registro de tratamientos, y rol de DPO. La feature `documents` almacena PDFs/DOCX/imágenes que comúnmente contienen datos personales (cédulas, escrituras, contactos, condiciones financieras), por lo que es **alcance directo**.

## Implementación actual (V1) — qué ya cumplimos

- **Tenant isolation**: RLS con `get_my_tenant_id()` en todas las tablas (`documents`, `document_versions`, `document_assignments`, `share_links`, `share_link_history`, `anonymous_upload_portals`, `anonymous_uploads`).
- **Bucket privado** `documents` con MIME whitelist y file_size_limit en storage.
- **Versionado inmutable** con `sha256` (verificable por el receptor del shortlink).
- **Audit trail** parcial vía `share_link_history` (cambios de target/version) y triggers de `INSERT/UPDATE`.
- **Soft delete** (`documents.deleted_at`) — no se borra storage físicamente, permite revert por incidente.
- **Consentimiento anonymous portal**: campo `anonymous_uploads.consent_given_at` + checkbox obligatorio en UI pública.
- **Hash + integrity warning** en cliente: detecta cambios no autorizados al abrir desde caché.
- **Stub antivirus** con interfaz lista para conectar ClamAV/servicio externo.

## Gaps a resolver antes de 2026

| Prioridad | Gap | Acción concreta |
|---|---|---|
| **H** | No hay retención configurable. Documentos quedan vivos indefinidamente vía soft-delete. | Agregar `retention_policy_days` por tenant (campo en `tenants`). Cron diario que purga `documents.deleted_at + retention_days`: borra storage físicamente + storage de versiones, marca registro como `hard_deleted_at`. |
| **H** | DSAR (derecho de acceso/portabilidad) no implementado. | Endpoint `/api/v1/users/me/data-export` que dumpea documents + versions + assignments (donde `created_by = user.id` o el contact_id está vinculado al usuario) en JSON + archivos zip. Endpoint similar para erase (`DELETE /users/me/data` con justificación, soft-delete + cron purge anticipada). |
| **H** | Audit log de accesos. No sabemos quién descargó qué documento ni cuándo. | Tabla `document_access_log (id, document_id, version_id, accessed_by, accessed_at, source = 'app|shortlink|portal', ip, user_agent)`. Insert en cada `signed_url` generado y cada resolución pública de shortlink. Retener 12-24 meses. |
| **M** | Hard-delete real de storage. Soft-delete actual NO borra `1_raw/` ni `2_normalized/`. | Job de purga (ver gap retención) + endpoint admin `POST /admin/documents/{id}/purge` para borrar inmediatamente bajo justificación. Logear en audit trail con razón. |
| **M** | Política de privacidad linkeable desde portales públicos. | Página estática `/privacy-policy` (Spanish/Chile específico). Link visible desde `portal-public-page` y `share-public-page`. Incluir DPO contact + procedimiento DSAR. |
| **M** | Notificación de brecha. | Procedimiento documentado + plantilla email. Si `document_versions.scan_status='infected'` o detección anómala en `document_access_log` (>N descargas inusuales), alerta a admin. Dashboard de incidentes. |
| **M** | Registro de tratamientos. | Documento separado (`docs/compliance/registro-tratamientos.md`) que liste finalidad de cada tabla con datos personales, fuente, retención, destinatarios. Mantener actualizado. |
| **L** | Cifrado en reposo verificado. | Confirmar Supabase storage encryption (AES-256 at rest está documentado por Supabase). Documentar en `docs/compliance/encryption.md`. Si datos extra-sensibles (Cédula de identidad), considerar cifrado adicional cliente-cliente. |
| **L** | Anonymous portal sin captcha. | Conectar Cloudflare Turnstile o hCaptcha al endpoint público (campo `Turnstile-Token` ya soportable). Rate-limit ya en planning vía slowapi. |
| **L** | Strip metadata insuficiente para imágenes. | Actualmente solo strip de PDFs. Para imágenes (JPEG/PNG/WebP) implementar EXIF strip server-side (perdería GPS data, device info). Usar `Pillow` cuando se agregue. |
| **L** | Reporte exportable de uso de datos por contact. | Endpoint admin `/admin/contacts/{id}/data-summary` que liste todos los documentos/versions/access logs vinculados a ese contact. Útil ante DSAR de un cliente. |

## Plug-points listos que requieren coordinación legal

- **OCR + AI análisis**: si extrae datos personales de imágenes, debe registrarse como tratamiento adicional. Antes de activar, ajustar política privacidad y obtener consentimiento explícito o base legal.
- **Firmas digitales**: integraciones DocuSign/FirmaVirtual.cl tienen sus propios términos. Validar transferencia internacional de datos (Art. 27 Ley 21.719).
- **Web scraping import**: solo aplicar a fuentes públicas + documentar fuente en `original_metadata`.

## DPO / responsable

- Designar Data Protection Officer interno (admin@propos.app o similar).
- Email DPO debe ir en política de privacidad.
- Procedimiento DSAR: máximo 30 días desde solicitud (Art. 12).

## Checklist pre-2026

- [ ] Implementar gaps H (retención + DSAR + audit log)
- [ ] Implementar gaps M (purga storage + privacy policy + notificación brechas + registro)
- [ ] Implementar gaps L (cifrado validado + captcha + EXIF strip + reportes)
- [ ] Designar DPO + publicar email
- [ ] Auditoría externa de cumplimiento
- [ ] Capacitación equipo (qué pueden/no pueden hacer con docs)

## Referencias

- Ley 21.719 (BCN): https://www.bcn.cl/leychile/navegar?idNorma=1209272
- Reglamento (cuando se publique).
- Mejores prácticas: NIST Privacy Framework, ISO 27701.

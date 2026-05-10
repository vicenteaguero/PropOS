# Reglas operacionales de cumplimiento

> Restricciones de uso de features sensibles mientras no exista DPA explícito o evidencia de consentimiento. Versión 1.0 — 2026-05-10.

## Anita — Audio biométrico (Groq Whisper STT)

- **Estado**: deshabilitado por default.
- **Flag**: `ANITA_STT_ENABLED=false` en `.env`.
- **Reactivar cuando**: se obtenga DPA explícito con Groq O se cambie a un proveedor con DPA chileno/europeo, O se hospede el modelo on-prem.
- **Razón**: la voz es dato biométrico bajo Ley 21.719, requiere consentimiento expreso, escrito y específico. Sin DPA explícito con el proveedor, no hay base legal para transferir.

## WhatsApp — Broadcast / mensajes masivos

- **Estado**: deshabilitado por default.
- **Flag**: `WHATSAPP_BROADCAST_ENABLED=false` en `.env`.
- **Permitido**: mensajes 1-a-1 iniciados por el contacto o respondiendo dentro de la ventana de 24h.
- **No permitido**: campañas masivas a leads sin opt-in registrado.
- **Reactivar cuando**: existan opt-ins registrados verificables y DPA con Kapso firmado.

## Anita — Decisiones automáticas

- **Política**: ninguna mutación se ejecuta sin aprobación humana.
- **Mecanismo**: tabla `pending_proposals` con accept/reject manual del corredor.
- **No tocar**: no introducir auto-accept ni cron que apruebe en lote.
- **Razón**: Ley 21.719 reconoce derecho a oponerse a decisiones automatizadas. PropOS cumple porque toda decisión IA pasa por humano.

## Datos sensibles (cédulas, Dicom, F22, liquidaciones)

- Subir solo a bucket privado `documents`.
- Usar signed URLs con expiración <1h.
- Audit log de lecturas activado.
- Borrado manual cuando termine el proceso (job automatizado deferido — ver plan v2 archivado).
- No enviar por WhatsApp ni por email sin cifrado.

## Marketing por email / push

- Solo a contactos con consentimiento `marketing` registrado en `people.consent.purposes`.
- Cada email debe incluir link de unsubscribe (cuando se implemente la feature).
- Revisar antes de cada campaña que la cohorte respeta los consentimientos.

## Acceso al repo

- Repositorio privado.
- Acceso git limitado (solo desarrolladores autorizados).
- Rotación de service-role keys cada 6 meses.
- No commitear `.env` real ni keys.

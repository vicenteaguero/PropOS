# Procedimiento de Brecha de Seguridad

> Ley N° 21.719, Art. 14 octies. Plazo legal: notificar a APDP dentro de **72 horas** desde el conocimiento del incidente, y a los titulares afectados si existe riesgo significativo. Versión 1.0 — 2026-05-10.

## 1. Detección

Una brecha puede detectarse por:

- Acceso no autorizado a la base de datos.
- Filtración accidental de credenciales (API keys, service-role tokens en commit público, env vars expuestas).
- Pérdida o robo de dispositivo con acceso a datos.
- Mensajes de soporte de Supabase / Vercel / GCP indicando incidente.
- Alertas inusuales en `audit_log` (descargas masivas, accesos fuera de horario, mismo subject consultado por usuarios distintos).
- Reporte de un usuario o tercero.

## 2. Contención inmediata (primeros 60 min)

1. Identificar el alcance: qué tablas, qué tenants, cuántos titulares.
2. Cortar acceso del vector identificado:
   - Si es un service-role key filtrado: rotar en Supabase Dashboard.
   - Si es un usuario interno: deshabilitar su cuenta en `auth.users` (set `banned_until = '2099'` vía admin API).
   - Si es un sub-encargado: contactar soporte del proveedor.
3. Hacer snapshot del estado actual de `audit_log` (export a archivo) para preservar evidencia.
4. Documentar timeline en `docs/internal-plans/incident-YYYY-MM-DD.md` (gitignored).

## 3. Evaluación de gravedad

Decidir si hay **riesgo significativo** para los titulares:

| Caso | ¿Riesgo significativo? |
|---|---|
| Filtración de RUT + email + teléfono de >50 personas | Sí |
| Filtración de cédula, Dicom o F22 de cualquier persona | Sí (siempre) |
| Acceso interno indebido sin extracción de datos | Probable |
| Filtración de datos no personales (configuración, logs sin PII) | No |

Si hay duda, asumir Sí.

## 4. Notificación a la APDP (<72h)

Plantilla email a `contacto@apdp.cl` (o el canal oficial cuando esté operativo):

```
Asunto: Notificación de incidente de seguridad — Ley 21.719 Art. 14 octies

Estimados,

En cumplimiento del Art. 14 octies de la Ley N° 21.719, notifico el siguiente incidente:

1. Responsable: [CETER Propiedades / ANAIDA]
   Encargado: PropOS
   Contacto: privacidad@propos.cl

2. Fecha y hora de detección: [YYYY-MM-DD HH:MM, zona horaria]
3. Fecha y hora estimada de la brecha: [YYYY-MM-DD HH:MM, si se conoce]

4. Descripción del incidente: [qué pasó, sin PII de víctimas]

5. Categorías de datos afectados: [identificación, contacto, sensibles, etc.]
6. Número aproximado de titulares afectados: [N]

7. Consecuencias probables: [robo de identidad, spam, fraude, etc.]

8. Medidas adoptadas:
   - Contención: [acción tomada y hora]
   - Mitigación: [acción tomada y hora]
   - Comunicación a titulares: [planeada / realizada / no aplicable]

9. Punto de contacto para seguimiento: privacidad@propos.cl

Quedo a disposición para entregar antecedentes adicionales.

[Nombre]
[Cargo]
[Teléfono]
```

## 5. Notificación a titulares afectados

Si hay riesgo significativo, enviar email individual:

```
Asunto: Aviso importante sobre tus datos personales

Hola [Nombre],

Te escribimos para informarte que el [fecha] detectamos un incidente de seguridad
que pudo haber afectado tus datos personales que conservamos como [responsable: CETER/ANAIDA].

Datos potencialmente afectados: [lista clara, sin tecnicismos].

Qué hicimos:
- [contención]
- [mitigación]
- Notificamos a la Agencia de Protección de Datos Personales (APDP) el [fecha].

Qué te recomendamos:
- [acciones específicas según el caso: cambiar contraseñas, monitorear Dicom, etc.]

Si tienes preguntas, escríbenos a privacidad@propos.cl.

Lamentamos sinceramente la situación.

[Nombre]
```

## 6. Registro post-incidente

Aunque no haya obligación de notificar, **siempre** registrar internamente:

- Crear archivo `docs/internal-plans/incident-YYYY-MM-DD-[slug].md` (gitignored).
- Incluir: timeline, root cause, datos afectados, decisiones, lecciones, acciones de mejora.
- Conservar 5 años (alineado con retención de `audit_log`).

## 7. Mejora continua

Después del incidente:

- Revisar `audit_log` por patrones similares en los 90 días previos.
- Actualizar `rat.yaml` si cambió alguna medida de seguridad.
- Si la brecha vino de un sub-encargado, evaluar reemplazo o renegociar DPA.
- Capacitar al equipo si el vector fue humano.

// Snapshot of docs/compliance/privacy-policy.md.
// Source of truth lives in docs/. Update both files when the policy changes
// and bump tenants.privacy_policy_version.

export const PRIVACY_POLICY_VERSION = "1.0";
export const PRIVACY_POLICY_EFFECTIVE_FROM = "2026-05-10";

export const PRIVACY_POLICY_MD = `# Política de Privacidad

> Versión ${PRIVACY_POLICY_VERSION} — vigente desde ${PRIVACY_POLICY_EFFECTIVE_FROM}. Aplica a las marcas operativas **CETER Propiedades** y **ANAIDA**, ambas operadas con la plataforma PropOS.

## 1. Quiénes somos

CETER Propiedades y ANAIDA son corredoras de propiedades que operan en Chile. La gestión interna de contactos, propietarios, propiedades y comunicaciones se realiza con la plataforma PropOS.

Para efectos de la Ley N° 21.719, **CETER Propiedades** y **ANAIDA** actúan como **Responsables del Tratamiento** de los datos personales que recolectan en su operación. **PropOS** actúa como **Encargado del Tratamiento**.

Punto de contacto de privacidad: **privacidad@propos.cl**.

## 2. Qué datos recolectamos

Recolectamos los siguientes datos cuando entras en contacto con nosotros como cliente, propietario o interesado:

- **Identificación**: nombre, apellidos, RUT.
- **Contacto**: email, teléfono, dirección.
- **Comunicaciones**: contenido de tus mensajes (WhatsApp, email, llamadas registradas) y notas internas asociadas a tu interés.
- **Información de propiedades**: cuando cedes una propiedad o muestras interés, registramos la propiedad, condiciones, montos y documentos asociados.
- **Datos transaccionales**: si avanzas en un proceso de arriendo o compra, datos financieros y documentos de respaldo (cédula, liquidaciones, F22, Dicom).
- **Datos técnicos**: cuando interactúas con nuestros sitios web o aplicación, IP, navegador, dispositivo y páginas visitadas.

No solicitamos datos sensibles (salud, opinión política, religión) y no los registramos voluntariamente.

## 3. Para qué los usamos

- Brindar el servicio de corretaje (búsqueda, visitas, negociación, cierre).
- Comunicarnos contigo sobre propiedades de tu interés.
- Cumplir obligaciones tributarias y legales (facturación, archivo).
- Mejorar nuestros servicios mediante análisis interno.
- Marketing dirigido — solo si das consentimiento explícito.

## 4. Cuánto los guardamos

| Tipo de dato | Plazo |
|---|---|
| Leads y prospectos sin actividad | 24 meses desde el último contacto |
| Datos de operaciones cerradas | 6 años (obligación tributaria) |
| Documentos sensibles (cédulas, Dicom, F22) en procesos no cerrados | 30 días desde el cierre fallido |
| Conversaciones WhatsApp | 24 meses |
| Datos de auditoría | 5 años |
| Consentimientos otorgados | Mientras dure la relación + 5 años (evidencia legal) |

## 5. Con quién los compartimos

PropOS contrata sub-encargados para procesar datos. Los principales son: Supabase (US), Vercel (US), Google Cloud (US), Anthropic (US), Cerebras (US), Kapso (BSP WhatsApp), Resend (US).

Las transferencias internacionales se amparan en Cláusulas Contractuales Tipo (SCC) publicadas por cada proveedor.

No vendemos ni cedemos tus datos a terceros con fines comerciales.

## 6. Cookies

Usamos cookies estrictamente necesarias para la operación del sitio (sesión, preferencias). No usamos cookies de seguimiento publicitario.

## 7. Tus derechos

Bajo la Ley N° 21.719 tienes derecho a:

- **Acceso** — saber qué datos tenemos sobre ti.
- **Rectificación** — corregir datos errados.
- **Cancelación / Supresión** — pedir que los borremos (con las limitaciones legales).
- **Oposición** — pedir que dejemos de usar tus datos para una finalidad específica.
- **Portabilidad** — recibir tus datos en formato estructurado.
- **Bloqueo temporal** — suspender el tratamiento mientras resolvemos una disputa.
- **Oposición a decisiones automatizadas** — pedir intervención humana.

## 8. Cómo ejercer tus derechos

Escríbenos a **privacidad@propos.cl** desde el email con el que nos contactaste, indicando tu nombre, RUT y derecho a ejercer. Te responderemos en máximo **30 días corridos**, prorrogable por 30 días adicionales si la solicitud es compleja.

## 9. Seguridad

Cifrado en reposo (AES-256), TLS en tránsito, control de acceso por roles, registro de auditoría, copias de seguridad y aislamiento multi-tenant.

## 10. Notificación de brechas

En caso de incidente de seguridad que afecte tus datos, notificaremos a la APDP dentro de las 72 horas y a ti directamente si existe riesgo significativo.

## 11. Cambios

Si actualizamos esta política, publicaremos la nueva versión con su fecha. La versión vigente siempre estará en /privacidad.

## 12. Contacto

- Email: **privacidad@propos.cl**
- Reclamos: **Agencia de Protección de Datos Personales (APDP)**.
`;

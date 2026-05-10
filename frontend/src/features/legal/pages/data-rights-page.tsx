import { Link } from "react-router-dom";

const PRIVACY_EMAIL = "privacidad@propos.cl";

export function DataRightsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-sm font-medium text-primary hover:underline">
            ← Inicio
          </Link>
          <Link to="/privacidad" className="text-sm text-muted-foreground hover:underline">
            Política de privacidad
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="mb-2 text-3xl font-bold">Tus derechos sobre tus datos</h1>
        <p className="mb-8 text-muted-foreground">
          Bajo la Ley N° 21.719 de Chile tienes derechos sobre los datos personales que tenemos
          sobre ti.
        </p>

        <section className="mb-8 space-y-4">
          <h2 className="text-xl font-semibold">¿Qué puedes pedirnos?</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Acceso</strong> — saber qué datos tenemos sobre ti.
            </li>
            <li>
              <strong>Rectificación</strong> — corregir datos errados o desactualizados.
            </li>
            <li>
              <strong>Cancelación / Supresión</strong> — pedir que los borremos (con las
              limitaciones legales, ej. obligación tributaria).
            </li>
            <li>
              <strong>Oposición</strong> — pedir que dejemos de usar tus datos para una finalidad
              específica (ej. marketing).
            </li>
            <li>
              <strong>Portabilidad</strong> — recibir tus datos en formato estructurado.
            </li>
            <li>
              <strong>Bloqueo temporal</strong> — suspender el tratamiento mientras resolvemos una
              disputa.
            </li>
            <li>
              <strong>Oposición a decisiones automatizadas</strong> — pedir intervención humana en
              decisiones que te afecten.
            </li>
          </ul>
        </section>

        <section className="mb-8 space-y-4">
          <h2 className="text-xl font-semibold">¿Cómo lo haces?</h2>
          <p>
            Escríbenos un email a{" "}
            <a
              href={`mailto:${PRIVACY_EMAIL}`}
              className="font-medium text-primary hover:underline"
            >
              {PRIVACY_EMAIL}
            </a>{" "}
            <strong>desde la dirección con la que nos contactaste</strong>. Indica:
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Tu nombre y RUT.</li>
            <li>Email registrado.</li>
            <li>Qué derecho ejerces.</li>
            <li>Una descripción breve.</li>
          </ul>
        </section>

        <section className="mb-8 space-y-4">
          <h2 className="text-xl font-semibold">Plazo de respuesta</h2>
          <p>
            Te responderemos en un plazo máximo de <strong>30 días corridos</strong> desde que
            verifiquemos tu identidad. Si la solicitud es compleja, podemos extender el plazo por 30
            días adicionales avisándote previamente.
          </p>
        </section>

        <section className="mb-8 space-y-4">
          <h2 className="text-xl font-semibold">Verificación de identidad</h2>
          <p>
            Para proteger tus datos te pediremos confirmar tu identidad, normalmente respondiendo
            desde el email registrado. Si perdiste el acceso a ese email, te pediremos otra prueba
            (foto de cédula con selfie, o detalles que solo tú sabes).
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">¿No estás conforme?</h2>
          <p>
            Si no estás conforme con nuestra respuesta, puedes presentar un reclamo ante la{" "}
            <strong>Agencia de Protección de Datos Personales (APDP)</strong> de Chile.
          </p>
        </section>
      </main>
    </div>
  );
}

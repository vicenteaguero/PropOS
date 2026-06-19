import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PublicFooter } from "@shared/components/public-footer/public-footer";

const PRIVACY_EMAIL = "privacidad@propos.cl";

export function DataRightsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-muted-foreground"
          >
            <ArrowLeft className="size-4" strokeWidth={1.8} />
            Inicio
          </Link>
          <Link
            to="/privacidad"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Política de privacidad
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
        <h1 className="mb-2 text-[28px] font-bold leading-tight tracking-tight">
          Tus derechos sobre tus datos
        </h1>
        <p className="mb-9 text-[15px] leading-relaxed text-muted-foreground">
          Bajo la Ley N° 21.719 de Chile tienes derechos sobre los datos personales que tenemos
          sobre ti.
        </p>

        <div
          className="space-y-9 text-[15px] leading-relaxed text-muted-foreground
            [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-foreground
            [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:marker:text-faint
            [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline
            [&_strong]:font-semibold [&_strong]:text-foreground"
        >
          <section>
            <h2>¿Qué puedes pedirnos?</h2>
            <ul>
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

          <section>
            <h2>¿Cómo lo haces?</h2>
            <p className="mb-4">
              Escríbenos un email a{" "}
              <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>{" "}
              <strong>desde la dirección con la que nos contactaste</strong>. Indica:
            </p>
            <ul>
              <li>Tu nombre y RUT.</li>
              <li>Email registrado.</li>
              <li>Qué derecho ejerces.</li>
              <li>Una descripción breve.</li>
            </ul>
          </section>

          <section>
            <h2>Plazo de respuesta</h2>
            <p>
              Te responderemos en un plazo máximo de <strong>30 días corridos</strong> desde que
              verifiquemos tu identidad. Si la solicitud es compleja, podemos extender el plazo por
              30 días adicionales avisándote previamente.
            </p>
          </section>

          <section>
            <h2>Verificación de identidad</h2>
            <p>
              Para proteger tus datos te pediremos confirmar tu identidad, normalmente respondiendo
              desde el email registrado. Si perdiste el acceso a ese email, te pediremos otra prueba
              (foto de cédula con selfie, o detalles que solo tú sabes).
            </p>
          </section>

          <section>
            <h2>¿No estás conforme?</h2>
            <p>
              Si no estás conforme con nuestra respuesta, puedes presentar un reclamo ante la{" "}
              <strong>Agencia de Protección de Datos Personales (APDP)</strong> de Chile.
            </p>
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

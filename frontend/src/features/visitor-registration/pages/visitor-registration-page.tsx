import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, CheckCircle2, AlertTriangle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ConsentCheckbox,
  type ConsentEvidence,
} from "@shared/components/consent-checkbox/consent-checkbox";
import { IdScanCapture } from "@shared/components/id-scan-capture/id-scan-capture";
import { PublicFooter } from "@shared/components/public-footer/public-footer";
import { formatRut, isValidRut } from "@/lib/locale-cl";
import { toast } from "sonner";
import {
  fetchInvitation,
  submitInvitation,
  uploadId,
  type InvitationPublicView,
} from "../api/visitor-registration";
import { Field, FieldGroup } from "@shared/ui";
import { usePageTitle } from "@app/page-meta";

export function VisitorRegistrationPage() {
  usePageTitle("Registro de visita");
  const { slug } = useParams<{ slug: string }>();
  const [invitation, setInvitation] = useState<InvitationPublicView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ message: string; requiresEmail: boolean } | null>(
    null,
  );

  // Form state
  const [fullName, setFullName] = useState("");
  const [rut, setRut] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [consent, setConsent] = useState<ConsentEvidence | null>(null);
  const [idUploaded, setIdUploaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetchInvitation(slug)
      .then((inv) => {
        setInvitation(inv);
        if (inv.prefilled) {
          if (inv.prefilled.full_name) setFullName(inv.prefilled.full_name);
          if (inv.prefilled.rut) setRut(formatRut(inv.prefilled.rut));
          if (inv.prefilled.phone) setPhone(inv.prefilled.phone);
          if (inv.prefilled.address) setAddress(inv.prefilled.address);
        }
        if (inv.has_id_document) setIdUploaded(true);
        setError(null);
      })
      .catch((err) => setError(err.message ?? String(err)))
      .finally(() => setLoading(false));
  }, [slug]);

  const isAuthMode = invitation?.mode === "auth_user";
  const passwordOk = !isAuthMode || (password.length >= 8 && password === passwordConfirm);
  const rutOk = rut.length > 2 && isValidRut(rut);
  const formOk =
    fullName.trim().length > 1 && rutOk && consent !== null && idUploaded && passwordOk;

  async function handleUploadId(pdfBlob: Blob) {
    if (!slug) return;
    try {
      await uploadId(slug, pdfBlob);
      setIdUploaded(true);
    } catch (err) {
      toast.error(`No se pudo subir el PDF: ${(err as Error).message}`);
      throw err;
    }
  }

  async function handleSubmit() {
    if (!slug || !invitation || !consent || !formOk) return;
    setSubmitting(true);
    try {
      const result = await submitInvitation(slug, {
        full_name: fullName.trim(),
        rut: rut.replace(/\./g, ""),
        phone: phone || undefined,
        address: address || undefined,
        password: isAuthMode ? password : undefined,
        consent_evidence: {
          text_shown: consent.text_shown,
          channel: consent.channel,
          user_agent: consent.user_agent,
        },
      });
      setSubmitted({
        message: result.message,
        requiresEmail: result.requires_email_confirmation,
      });
    } catch (err) {
      toast.error(`Error: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" strokeWidth={1.8} />
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-5 py-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <AlertTriangle className="size-7" strokeWidth={1.8} />
          </span>
          <h1 className="text-xl font-bold tracking-tight">No se pudo cargar la invitación</h1>
          <p className="text-[15px] text-muted-foreground">
            {error ?? "El link puede haber expirado o ya fue completado."}
          </p>
          <Button variant="outline" size="block" asChild className="mt-2 max-w-xs">
            <Link to="/">Volver al inicio</Link>
          </Button>
        </main>
        <PublicFooter />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-5 py-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="size-7" strokeWidth={1.8} />
          </span>
          <h1 className="text-2xl font-bold tracking-tight">¡Listo!</h1>
          <p className="text-[15px] text-muted-foreground">{submitted.message}</p>
          {submitted.requiresEmail && (
            <p className="flex items-center gap-2 text-[15px] text-muted-foreground">
              <Mail className="size-4" strokeWidth={1.8} /> Revisa tu casilla de email.
            </p>
          )}
        </main>
        <PublicFooter />
      </div>
    );
  }

  // Path B: existing account in auth_user mode
  const showLoginPath = invitation.existing_account && isAuthMode;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {invitation.tenant_slug.toUpperCase()}
          </span>
          <Link
            to="/privacidad"
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Privacidad
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
        <h1 className="mb-1 text-[26px] font-bold leading-tight tracking-tight">
          Registro de visita
        </h1>
        <p className="mb-7 text-[15px] text-muted-foreground">
          {invitation.property_title}
          {invitation.property_address ? ` · ${invitation.property_address}` : ""}
        </p>

        {showLoginPath ? (
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-4 text-[15px]">
              Ya tienes una cuenta. Para vincular esta propiedad a tu perfil, ingresá con tu
              contraseña.
            </p>
            <Button variant="ink" size="block" asChild>
              <Link to={`/login?email=${encodeURIComponent(invitation.email)}`}>Ingresar</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {invitation.existing_in_this_tenant && (
              <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-[15px]">
                Hola de nuevo. Confirma tus datos para esta nueva propiedad.
              </div>
            )}

            <div className="space-y-5 rounded-2xl border border-border bg-card p-5">
              <Field label="Email">
                <Input value={invitation.email} readOnly className="bg-muted" />
              </Field>

              <Field label="Nombre completo">
                <Input
                  id="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Juan Pérez González"
                  autoComplete="name"
                />
              </Field>

              <Field label="RUT">
                <Input
                  id="rut"
                  value={rut}
                  onChange={(e) => setRut(formatRut(e.target.value))}
                  placeholder="12.345.678-K"
                  inputMode="text"
                />
                {rut && !rutOk && <p className="text-xs text-destructive">RUT inválido</p>}
              </Field>

              <Field label="Teléfono (opcional)">
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+56 9 1234 5678"
                  autoComplete="tel"
                />
              </Field>

              <Field label="Dirección (opcional)">
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Av. Las Condes 123, Santiago"
                  autoComplete="street-address"
                />
              </Field>

              {isAuthMode && (
                <>
                  <Field label="Contraseña">
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      autoComplete="new-password"
                    />
                  </Field>
                  <Field label="Confirmar contraseña">
                    <Input
                      id="password_confirm"
                      type="password"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      autoComplete="new-password"
                    />
                    {passwordConfirm && password !== passwordConfirm && (
                      <p className="text-xs text-destructive">Las contraseñas no coinciden</p>
                    )}
                  </Field>
                </>
              )}
            </div>

            <FieldGroup
              label="Cédula de identidad (frente y reverso)"
              className="rounded-2xl border border-border bg-card p-5"
            >
              {idUploaded ? (
                <div className="flex items-center gap-2 text-[15px] font-medium text-success">
                  <CheckCircle2 className="size-[18px]" strokeWidth={1.8} /> Cédula registrada
                  <button
                    type="button"
                    className="ml-2 text-[13px] font-medium text-muted-foreground underline underline-offset-4"
                    onClick={() => setIdUploaded(false)}
                  >
                    Volver a escanear
                  </button>
                </div>
              ) : (
                <IdScanCapture onComplete={handleUploadId} />
              )}
            </FieldGroup>

            <div className="rounded-2xl border border-border bg-card p-5">
              <ConsentCheckbox
                purposes={["operacional", "registro_visitante"]}
                onChange={setConsent}
                channel="visitor_registration"
              />
            </div>

            <Button
              variant="ink"
              size="block"
              disabled={!formOk || submitting}
              onClick={handleSubmit}
            >
              {submitting ? <Loader2 className="size-4 animate-spin" strokeWidth={1.8} /> : null}
              Enviar registro
            </Button>
          </div>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}

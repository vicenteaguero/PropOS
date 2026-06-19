import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MailCheck } from "lucide-react";
import { supabase } from "@core/supabase/client";
import { AuthShell } from "@features/auth/components/auth-shell/auth-shell";
import { AuthError } from "@features/auth/components/auth-error/auth-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const redirectTo = `${window.location.origin}/auth/recovery`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    setIsSubmitting(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  return (
    <AuthShell subtitle="Restablecé tu contraseña">
      {sent ? (
        <div className="flex flex-col items-center gap-5 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary">
            <MailCheck className="size-6 text-foreground" strokeWidth={1.8} />
          </span>
          <p className="text-sm text-muted-foreground">
            Si el correo está registrado, te enviamos un link para restablecer tu contraseña.
            Revisá tu bandeja en los próximos minutos.
          </p>
          <Button asChild variant="outline" size="block">
            <Link to="/login">Volver al inicio de sesión</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="forgot-email" className="text-muted-foreground">
              Correo electrónico
            </Label>
            <Input
              id="forgot-email"
              type="email"
              required
              autoComplete="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              className="h-12 rounded-xl px-4 text-base"
            />
          </div>

          {error && <AuthError message={error} />}

          <Button type="submit" variant="ink" size="block" disabled={isSubmitting} className="mt-1">
            {isSubmitting ? <LoadingSpinner size="sm" /> : "Enviar link"}
          </Button>

          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" strokeWidth={1.8} />
            Volver al inicio de sesión
          </Link>
        </form>
      )}
    </AuthShell>
  );
}

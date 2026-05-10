import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@core/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import { PageLayout } from "@shared/components/page-layout";

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
    <PageLayout width="sm" centered>
      <Card className="mx-auto max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">PropOS</CardTitle>
          <CardDescription>Restablecé tu contraseña</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="flex flex-col gap-4 text-sm">
              <p>
                Si el correo está registrado, te enviamos un link para restablecer tu contraseña.
                Revisá tu bandeja en los próximos minutos.
              </p>
              <Link to="/login" className="text-primary underline">
                Volver al login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="forgot-email">Correo electrónico</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              {error && (
                <div
                  className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
                  {error}
                </div>
              )}
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? <LoadingSpinner size="sm" /> : "Enviar link"}
              </Button>
              <Link to="/login" className="text-center text-sm text-muted-foreground underline">
                Volver al login
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}

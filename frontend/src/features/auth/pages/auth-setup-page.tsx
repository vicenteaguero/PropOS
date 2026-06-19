import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@core/supabase/client";
import { AuthShell } from "@features/auth/components/auth-shell/auth-shell";
import { AuthError } from "@features/auth/components/auth-error/auth-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import { toast } from "sonner";

export function AuthSetupPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error || !data.session) {
        setError("Link inválido o expirado. Pedile a un admin que te reenvíe la invitación.");
        return;
      }
      setIsReady(true);
    });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setIsSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setIsSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    toast.success("Contraseña creada. Bienvenido a PropOS.");
    navigate("/", { replace: true });
  }

  return (
    <AuthShell subtitle="Activá tu cuenta creando una contraseña">
      {!isReady && !error && (
        <div className="flex justify-center py-8">
          <LoadingSpinner size="md" />
        </div>
      )}

      {error && !isReady && <AuthError message={error} />}

      {isReady && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="setup-password" className="text-muted-foreground">
              Nueva contraseña
            </Label>
            <Input
              id="setup-password"
              type="password"
              required
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              className="h-12 rounded-xl px-4 text-base"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="setup-password-confirm" className="text-muted-foreground">
              Confirmar contraseña
            </Label>
            <Input
              id="setup-password-confirm"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={isSubmitting}
              className="h-12 rounded-xl px-4 text-base"
            />
          </div>

          {error && <AuthError message={error} />}

          <Button type="submit" variant="ink" size="block" disabled={isSubmitting} className="mt-1">
            {isSubmitting ? <LoadingSpinner size="sm" /> : "Activar cuenta"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

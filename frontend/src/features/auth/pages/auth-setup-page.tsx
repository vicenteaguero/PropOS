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
import { usePageTitle } from "@app/page-meta";
import { apiRequest } from "@shared/api/http";

/**
 * `setup` is the invite/recovery link landing: the session comes from the link
 * itself, and failing to find one means the link is dead.
 *
 * `rotate` is the forced rotation an admin-created account lands on. The session
 * is a normal signed-in session, there is no way back out of the screen, and on
 * success it has to tell the server the demand is satisfied -- otherwise
 * `ProtectedRoute` bounces the user straight back here.
 */
type SetupMode = "setup" | "rotate";

interface AuthSetupPageProps {
  mode?: SetupMode;
}

export function AuthSetupPage({ mode = "setup" }: AuthSetupPageProps) {
  const isRotate = mode === "rotate";
  usePageTitle(isRotate ? "Cambiar contraseña" : "Configurar cuenta");
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error || !data.session) {
        setError(
          isRotate
            ? "Tu sesión expiró. Volvé a iniciar sesión para cambiar tu contraseña."
            : "Link inválido o expirado. Pedile a un admin que te reenvíe la invitación.",
        );
        return;
      }
      setIsReady(true);
    });
  }, [isRotate]);

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

    if (isRotate) {
      try {
        await apiRequest("/v1/users/me/password-changed", { method: "POST" });
      } catch {
        // The password IS changed at this point -- Supabase already accepted it.
        // Only the flag failed to clear, so the user lands back here and can
        // set it again. Saying "no se pudo" would be a lie about the password.
        setError("Contraseña actualizada, pero no pudimos confirmarlo. Intentá de nuevo.");
        return;
      }
      toast.success("Contraseña actualizada.");
      // Full reload rather than navigate: the profile in the auth context still
      // carries must_change_password = true, and re-entering the app with the
      // stale value would bounce straight back to this screen.
      window.location.replace("/");
      return;
    }

    toast.success("Contraseña creada. Bienvenido a PropOS.");
    navigate("/", { replace: true });
  }

  return (
    <AuthShell
      subtitle={
        isRotate
          ? "Elegí una contraseña propia para continuar"
          : "Activa tu cuenta creando una contraseña"
      }
    >
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
            {isSubmitting ? (
              <LoadingSpinner size="sm" />
            ) : isRotate ? (
              "Cambiar contraseña"
            ) : (
              "Activar cuenta"
            )}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

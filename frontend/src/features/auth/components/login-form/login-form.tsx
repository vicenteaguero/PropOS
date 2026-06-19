import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useLogin } from "@features/auth/hooks/use-login";
import { AuthError } from "@features/auth/components/auth-error/auth-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import { toast } from "sonner";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoading, error } = useLogin();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await login({ email, password });
    if (!result) {
      toast.error("Error al iniciar sesión");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="login-email" className="text-muted-foreground">
          Correo electrónico
        </Label>
        <Input
          id="login-email"
          type="email"
          required
          autoComplete="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          className="h-12 rounded-xl px-4 text-base"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="login-password" className="text-muted-foreground">
          Contraseña
        </Label>
        <Input
          id="login-password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          className="h-12 rounded-xl px-4 text-base"
        />
      </div>

      {error && <AuthError message={`Error: ${error}`} />}

      <Button type="submit" variant="ink" size="block" disabled={isLoading} className="mt-1">
        {isLoading ? <LoadingSpinner size="sm" /> : "Iniciar sesión"}
      </Button>

      <Link
        to="/forgot-password"
        className="text-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        ¿Olvidaste tu contraseña?
      </Link>
    </form>
  );
}

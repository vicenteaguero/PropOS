import { Navigate } from "react-router-dom";
import { LoginForm } from "@features/auth/components/login-form/login-form";
import { AuthShell } from "@features/auth/components/auth-shell/auth-shell";
import { useAuth } from "@shared/hooks/use-auth";

export function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <AuthShell subtitle="Plataforma de gestión inmobiliaria">
      <LoginForm />
    </AuthShell>
  );
}

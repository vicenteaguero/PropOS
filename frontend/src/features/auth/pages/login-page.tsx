import { Navigate } from "react-router-dom";
import { LoginForm } from "@features/auth/components/login-form/login-form";
import { AuthShell } from "@features/auth/components/auth-shell/auth-shell";
import { AppSkeleton } from "@shared/components/app-skeleton/app-skeleton";
import { useAuth } from "@shared/hooks/use-auth";
import { usePageTitle } from "@app/page-meta";

export function LoginPage() {
  usePageTitle("Ingresar");
  const { isAuthenticated, isLoading } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // While the session/profile resolves (e.g. right after sign-in), show the app
  // skeleton instead of leaving the login form frozen until the redirect.
  if (isLoading) {
    return <AppSkeleton />;
  }

  return (
    <AuthShell subtitle="Plataforma de gestión inmobiliaria">
      <LoginForm />
    </AuthShell>
  );
}

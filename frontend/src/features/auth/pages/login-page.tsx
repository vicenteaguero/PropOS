import { Navigate } from "react-router-dom";
import { LoginForm } from "@features/auth/components/login-form/login-form";
import { useAuth } from "@shared/hooks/use-auth";

const BRAND_NAME = "PropOS";
const BRAND_TAGLINE = "Plataforma de gesti\u00F3n inmobiliaria";

export function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-negro-carbon px-4">
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold text-rosa-antiguo">{BRAND_NAME}</h1>
        <p className="text-sm text-gris-acero">{BRAND_TAGLINE}</p>
      </div>
      <LoginForm />
    </div>
  );
}

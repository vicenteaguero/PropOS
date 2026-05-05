import { Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@features/auth/components/login-form/login-form";
import { PageLayout } from "@shared/components/page-layout";
import { useAuth } from "@shared/hooks/use-auth";

export function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <PageLayout width="sm" centered>
      <Card className="mx-auto max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">PropOS</CardTitle>
          <CardDescription>Plataforma de gestión inmobiliaria</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </PageLayout>
  );
}

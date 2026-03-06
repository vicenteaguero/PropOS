import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@shared/hooks/use-auth";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import type { UserRole } from "@shared/types/auth";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <h1 className="mb-2 text-2xl font-bold text-primary">403</h1>
        <p className="text-muted-foreground">No tienes permisos para acceder a esta sección.</p>
      </div>
    );
  }

  return <>{children}</>;
}

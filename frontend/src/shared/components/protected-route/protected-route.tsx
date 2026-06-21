import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@shared/hooks/use-auth";
import { AppSkeleton } from "@shared/components/app-skeleton/app-skeleton";
import type { UserRole, UserView } from "@shared/types/auth";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole;
  requiredScope?: string;
  requiredView?: UserView | UserView[];
  requiredDevAdmin?: boolean;
}

function Forbidden() {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <h1 className="mb-2 text-2xl font-bold text-primary">403</h1>
      <p className="text-muted-foreground">No tienes permisos para acceder a esta sección.</p>
    </div>
  );
}

export function ProtectedRoute({
  children,
  requiredRole,
  requiredScope,
  requiredView,
  requiredDevAdmin,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <AppSkeleton />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Forbidden />;
  }

  if (requiredView && user) {
    const allowed = Array.isArray(requiredView) ? requiredView : [requiredView];
    if (!allowed.includes(user.view)) {
      return <Forbidden />;
    }
  }

  if (requiredDevAdmin && !user?.isDevAdmin) {
    return <Forbidden />;
  }

  if (requiredScope && user) {
    const scope = user.adminScope ?? [];
    if (scope.length > 0 && !scope.includes(requiredScope)) {
      return <Forbidden />;
    }
  }

  return <>{children}</>;
}

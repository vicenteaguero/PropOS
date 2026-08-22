import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@shared/hooks/use-auth";
import { AppSkeleton } from "@shared/components/app-skeleton/app-skeleton";
import { entryFor } from "@shared/feature/catalog";
import { FeatureLockedScreen } from "@shared/feature/feature-gate";
import type { UserRole, UserView } from "@shared/types/auth";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole;
  requiredScope?: string;
  /**
   * Feature key. `hidden` sends the user home as if the route did not exist,
   * `locked` renders the locked screen with the tenant's note. Separate from
   * `requiredScope`, which is about the person rather than the feature.
   */
  requiredFeature?: string;
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
  requiredFeature,
  requiredView,
  requiredDevAdmin,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user, features } = useAuth();

  if (isLoading) {
    return <AppSkeleton />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // A temporary password handed over in person is a shared password until it is
  // rotated. Every protected route funnels through here, so this one check is
  // the whole enforcement -- there is no route that skips it.
  if (user?.mustChangePassword) {
    return <Navigate to="/auth/cambiar-clave" replace />;
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

  if (requiredFeature) {
    const gate = entryFor(features, requiredFeature);
    if (gate.state === "hidden") {
      return <Navigate to="/" replace />;
    }
    if (gate.state === "locked") {
      return <FeatureLockedScreen note={gate.note} />;
    }
  }

  return <>{children}</>;
}

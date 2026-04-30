import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@shared/components/protected-route/protected-route";
import { useAuth } from "@shared/hooks/use-auth";
import { LoginPage } from "@features/auth/pages/login-page";
import { AppLayout } from "@layouts/app-layout";
import { EmptyDashboard } from "@shared/components/empty-dashboard/empty-dashboard";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import { DocumentsPage } from "@features/documents/pages/documents-page";
import { DocumentDetailPage } from "@features/documents/pages/document-detail-page";
import { DocumentEditorPage } from "@features/documents/pages/document-editor-page";
import { PortalAdminPage } from "@features/documents/pages/portal-admin-page";
import { SharePublicPage } from "@features/documents/pages/share-public-page";
import { PortalPublicPage } from "@features/documents/pages/portal-public-page";
import type { UserRole } from "@shared/types/auth";

const ROLE_HOME_PATHS: Record<UserRole, string> = {
  ADMIN: "/admin",
  AGENT: "/agent",
  LANDOWNER: "/landowner",
  BUYER: "/buyer",
  CONTENT: "/content",
};

function RoleRedirect() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={ROLE_HOME_PATHS[user.role]} replace />;
}

const ROLE_ROUTES: UserRole[] = ["ADMIN", "AGENT", "LANDOWNER", "BUYER", "CONTENT"];

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RoleRedirect />} />

      <Route path="/r/:slug" element={<SharePublicPage />} />
      <Route path="/p/:slug" element={<PortalPublicPage />} />

      {ROLE_ROUTES.map((role) => (
        <Route
          key={role}
          path={`/${role.toLowerCase()}`}
          element={
            <ProtectedRoute requiredRole={role}>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<EmptyDashboard />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="documents/portals" element={<PortalAdminPage />} />
          <Route path="documents/:id" element={<DocumentDetailPage />} />
          <Route path="documents/:id/edit" element={<DocumentEditorPage />} />
        </Route>
      ))}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

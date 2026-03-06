import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@shared/components/protected-route/protected-route";
import { useAuth } from "@shared/hooks/use-auth";
import { LoginPage } from "@features/auth/pages/login-page";
import { AdminLayout } from "@layouts/admin/admin-layout";
import { AgentLayout } from "@layouts/agent/agent-layout";
import { LandownerLayout } from "@layouts/landowner/landowner-layout";
import { BuyerLayout } from "@layouts/buyer/buyer-layout";
import { ContentLayout } from "@layouts/content/content-layout";
import { PropertiesPage } from "@features/properties/pages/properties-page";
import { PropertyDetailPage } from "@features/properties/pages/property-detail-page";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import type { UserRole } from "@shared/types/auth";

const ROLE_HOME_PATHS: Record<UserRole, string> = {
  ADMIN: "/admin/properties",
  AGENT: "/agent/properties",
  LANDOWNER: "/landowner/properties",
  BUYER: "/buyer/properties",
  CONTENT: "/content/projects",
};

const PLACEHOLDER_TITLE = "Pr\u00F3ximamente";
const PLACEHOLDER_DESC = "Esta secci\u00F3n est\u00E1 en desarrollo.";

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-10 flex min-h-14 items-center border-b border-gris-acero/20 bg-negro-carbon px-4 py-3">
        <h1 className="text-lg font-semibold text-blanco-nieve">{title}</h1>
      </header>
      <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
        <h3 className="mb-2 text-lg font-semibold text-blanco-nieve">{PLACEHOLDER_TITLE}</h3>
        <p className="text-sm text-gris-acero">{PLACEHOLDER_DESC}</p>
      </div>
    </div>
  );
}

function RoleRedirect() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-negro-carbon">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const homePath = ROLE_HOME_PATHS[user.role];
  return <Navigate to={homePath} replace />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RoleRedirect />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/admin/properties" replace />} />
        <Route path="properties" element={<PropertiesPage basePath="/admin/properties" />} />
        <Route path="properties/:id" element={<PropertyDetailPage />} />
        <Route path="contacts" element={<PlaceholderPage title="Contactos" />} />
        <Route path="projects" element={<PlaceholderPage title="Proyectos" />} />
        <Route path="users" element={<PlaceholderPage title="Equipo" />} />
      </Route>

      <Route
        path="/agent"
        element={
          <ProtectedRoute requiredRole="AGENT">
            <AgentLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/agent/properties" replace />} />
        <Route path="properties" element={<PropertiesPage basePath="/agent/properties" />} />
        <Route path="properties/:id" element={<PropertyDetailPage />} />
        <Route path="contacts" element={<PlaceholderPage title="Contactos" />} />
        <Route path="interactions" element={<PlaceholderPage title="Interacciones" />} />
      </Route>

      <Route
        path="/landowner"
        element={
          <ProtectedRoute requiredRole="LANDOWNER">
            <LandownerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/landowner/properties" replace />} />
        <Route path="properties" element={<PropertiesPage basePath="/landowner/properties" />} />
        <Route path="properties/:id" element={<PropertyDetailPage />} />
        <Route path="documents" element={<PlaceholderPage title="Documentos" />} />
      </Route>

      <Route
        path="/buyer"
        element={
          <ProtectedRoute requiredRole="BUYER">
            <BuyerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/buyer/properties" replace />} />
        <Route path="properties" element={<PropertiesPage basePath="/buyer/properties" />} />
        <Route path="properties/:id" element={<PropertyDetailPage />} />
        <Route path="projects" element={<PlaceholderPage title="Proyectos" />} />
      </Route>

      <Route
        path="/content"
        element={
          <ProtectedRoute requiredRole="CONTENT">
            <ContentLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/content/projects" replace />} />
        <Route path="projects" element={<PlaceholderPage title="Proyectos" />} />
        <Route path="assets" element={<PlaceholderPage title="Contenido" />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

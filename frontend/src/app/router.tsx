import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@shared/components/protected-route/protected-route";
import { useAuth } from "@shared/hooks/use-auth";
import { LoginPage } from "@features/auth/pages/login-page";
import { AppLayout } from "@layouts/app-layout";
import { PropertiesPage } from "@features/properties/pages/properties-page";
import { PropertyDetailPage } from "@features/properties/pages/property-detail-page";
import { ContactsPage } from "@features/contacts/pages/contacts-page";
import { ProjectsPage } from "@features/projects/pages/projects-page";
import { UsersPage } from "@features/admin/pages/users-page";
import { TestLabPage } from "@features/test-lab/pages/test-lab-page";
import { SettingsPage } from "@features/settings/pages/settings-page";
import { DocumentsPage } from "@features/documents/pages/documents-page";
import { ChatPage } from "@features/chat/pages/chat-page";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import { Construction } from "lucide-react";
import type { UserRole } from "@shared/types/auth";

const ROLE_HOME_PATHS: Record<UserRole, string> = {
  ADMIN: "/admin/properties",
  AGENT: "/agent/properties",
  LANDOWNER: "/landowner/properties",
  BUYER: "/buyer/properties",
  CONTENT: "/content/projects",
};

const PLACEHOLDER_TITLE = "Próximamente";
const PLACEHOLDER_DESC = "Esta sección está en desarrollo.";

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <Construction className="mb-4 size-16 text-primary/40" strokeWidth={1} />
      <h3 className="mb-2 text-lg font-semibold text-foreground">{PLACEHOLDER_TITLE}</h3>
      <p className="text-sm text-muted-foreground">{PLACEHOLDER_DESC}</p>
      <p className="mt-1 text-xs text-muted-foreground">{title}</p>
    </div>
  );
}

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
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/admin/properties" replace />} />
        <Route path="properties" element={<PropertiesPage basePath="/admin/properties" />} />
        <Route path="properties/:id" element={<PropertyDetailPage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="chat" element={<ChatPage basePath="/admin/chat" />} />
        <Route path="chat/:conversationId" element={<ChatPage basePath="/admin/chat" />} />
        <Route path="test-lab" element={<TestLabPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route
        path="/agent"
        element={
          <ProtectedRoute requiredRole="AGENT">
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/agent/properties" replace />} />
        <Route path="properties" element={<PropertiesPage basePath="/agent/properties" />} />
        <Route path="properties/:id" element={<PropertyDetailPage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="interactions" element={<PlaceholderPage title="Interacciones" />} />
        <Route path="chat" element={<ChatPage basePath="/agent/chat" />} />
        <Route path="chat/:conversationId" element={<ChatPage basePath="/agent/chat" />} />
        <Route path="test-lab" element={<TestLabPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route
        path="/landowner"
        element={
          <ProtectedRoute requiredRole="LANDOWNER">
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/landowner/properties" replace />} />
        <Route path="properties" element={<PropertiesPage basePath="/landowner/properties" />} />
        <Route path="properties/:id" element={<PropertyDetailPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="chat" element={<ChatPage basePath="/landowner/chat" />} />
        <Route path="chat/:conversationId" element={<ChatPage basePath="/landowner/chat" />} />
        <Route path="test-lab" element={<TestLabPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route
        path="/buyer"
        element={
          <ProtectedRoute requiredRole="BUYER">
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/buyer/properties" replace />} />
        <Route path="properties" element={<PropertiesPage basePath="/buyer/properties" />} />
        <Route path="properties/:id" element={<PropertyDetailPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="chat" element={<ChatPage basePath="/buyer/chat" />} />
        <Route path="chat/:conversationId" element={<ChatPage basePath="/buyer/chat" />} />
        <Route path="test-lab" element={<TestLabPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route
        path="/content"
        element={
          <ProtectedRoute requiredRole="CONTENT">
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/content/projects" replace />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="assets" element={<PlaceholderPage title="Contenido" />} />
        <Route path="chat" element={<ChatPage basePath="/content/chat" />} />
        <Route path="chat/:conversationId" element={<ChatPage basePath="/content/chat" />} />
        <Route path="test-lab" element={<TestLabPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

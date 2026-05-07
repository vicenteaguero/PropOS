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
import { PendingPage } from "@features/pending/pages/pending-page";
import { AnalyticsPage } from "@features/analytics/pages/analytics-page";
import { AgentCostPage } from "@features/analytics/pages/agent-cost-page";
import { EntityTimelinePage } from "@features/analytics/pages/entity-timeline-page";
import { WorkflowsPage } from "@features/workflows/pages/workflows-page";
import { AgentChatPage } from "@features/agent/pages/agent-chat-page";
import { AdminHomePage } from "@features/home/pages/admin-home-page";
import { ClientInboxPage } from "@features/client-chat/pages/client-inbox-page";
import { AdminPhonesPage } from "@features/admin-phones/pages/admin-phones-page";
import { NovedadesPage } from "@features/novedades/pages/novedades-page";
import { SettingsPage } from "@features/settings/pages/settings-page";
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
  if (!user) return <Navigate to="/login" replace />;
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
          <Route index element={role === "ADMIN" ? <AdminHomePage /> : <EmptyDashboard />} />

          {role === "ADMIN" && (
            <Route
              path="agent"
              element={
                <ProtectedRoute requiredScope="agent">
                  <AgentChatPage />
                </ProtectedRoute>
              }
            />
          )}

          <Route
            path="pendientes"
            element={
              <ProtectedRoute requiredScope="pendientes">
                <PendingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="client-inbox"
            element={
              <ProtectedRoute requiredScope="inbox">
                <ClientInboxPage />
              </ProtectedRoute>
            }
          />
          {role === "ADMIN" && (
            <Route
              path="phones"
              element={
                <ProtectedRoute requiredScope="phones">
                  <AdminPhonesPage />
                </ProtectedRoute>
              }
            />
          )}

          <Route
            path="documents"
            element={
              <ProtectedRoute requiredScope="documents">
                <DocumentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="documents/portals"
            element={
              <ProtectedRoute requiredScope="documents">
                <PortalAdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="documents/:id"
            element={
              <ProtectedRoute requiredScope="documents">
                <DocumentDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="documents/:id/edit"
            element={
              <ProtectedRoute requiredScope="documents">
                <DocumentEditorPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="workflows"
            element={
              <ProtectedRoute requiredScope="workflows">
                <WorkflowsPage />
              </ProtectedRoute>
            }
          />
          <Route path="timeline/:table/:id" element={<EntityTimelinePage />} />
          {role === "ADMIN" && <Route path="novedades" element={<NovedadesPage />} />}
          {role === "ADMIN" && <Route path="settings" element={<SettingsPage />} />}

          {role === "ADMIN" && (
            <>
              <Route
                path="analytics"
                element={
                  <ProtectedRoute requiredScope="analytics">
                    <AnalyticsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="analytics/agent-cost"
                element={
                  <ProtectedRoute requiredScope="analytics">
                    <AgentCostPage />
                  </ProtectedRoute>
                }
              />
            </>
          )}
        </Route>
      ))}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

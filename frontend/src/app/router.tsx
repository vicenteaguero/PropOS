import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@shared/components/protected-route/protected-route";
import { useAuth } from "@shared/hooks/use-auth";
import { LoginPage } from "@features/auth/pages/login-page";
import { AuthSetupPage } from "@features/auth/pages/auth-setup-page";
import { ForgotPasswordPage } from "@features/auth/pages/forgot-password-page";
import { AppLayout } from "@layouts/app-layout";
import { EmptyDashboard } from "@shared/components/empty-dashboard/empty-dashboard";
import { PageMetaProvider } from "@app/page-meta";
import { AppSkeleton } from "@shared/components/app-skeleton/app-skeleton";
import type { UserRole, UserView } from "@shared/types/auth";

// Route-level code splitting. Every page below is fetched on first navigation
// instead of riding in the initial bundle. The auth pages stay eager: they are
// the first thing an unauthenticated visitor needs, and lazy-loading them would
// add a round trip to the critical path. The `.then` shim is required because
// these modules export named components rather than defaults.

const AdminHomePage = lazy(() =>
  import("@features/home/pages/admin-home-page").then((m) => ({ default: m.AdminHomePage })),
);
const AdminPhonesPage = lazy(() =>
  import("@features/admin-phones/pages/admin-phones-page").then((m) => ({
    default: m.AdminPhonesPage,
  })),
);
const AdminPropertiesPage = lazy(() =>
  import("@features/admin-properties/pages/admin-properties-page").then((m) => ({
    default: m.AdminPropertiesPage,
  })),
);
const AdminPropertyDetailPage = lazy(() =>
  import("@features/admin-properties/pages/admin-property-detail-page").then((m) => ({
    default: m.AdminPropertyDetailPage,
  })),
);
const AdminTenantsPage = lazy(() =>
  import("@features/admin-tenants/pages/admin-tenants-page").then((m) => ({
    default: m.AdminTenantsPage,
  })),
);
const AdminUserDetailPage = lazy(() =>
  import("@features/admin-users/pages/admin-user-detail-page").then((m) => ({
    default: m.AdminUserDetailPage,
  })),
);
const AdminUsersPage = lazy(() =>
  import("@features/admin-users/pages/admin-users-page").then((m) => ({
    default: m.AdminUsersPage,
  })),
);
const AdminVisitorInvitationsPage = lazy(() =>
  import("@features/admin-visitor-invitations/pages/admin-visitor-invitations-page").then((m) => ({
    default: m.AdminVisitorInvitationsPage,
  })),
);
const AgentChatPage = lazy(() =>
  import("@features/agent/pages/agent-chat-page").then((m) => ({ default: m.AgentChatPage })),
);
const AgentCostPage = lazy(() =>
  import("@features/analytics/pages/agent-cost-page").then((m) => ({ default: m.AgentCostPage })),
);
const AnalyticsPage = lazy(() =>
  import("@features/analytics/pages/analytics-page").then((m) => ({ default: m.AnalyticsPage })),
);
const BandejaPage = lazy(() =>
  import("@features/bandeja/pages/bandeja-page").then((m) => ({ default: m.BandejaPage })),
);
const CalendarPage = lazy(() =>
  import("@features/calendar/pages/calendar-page").then((m) => ({ default: m.CalendarPage })),
);
const ClientInboxPage = lazy(() =>
  import("@features/client-chat/pages/client-inbox-page").then((m) => ({
    default: m.ClientInboxPage,
  })),
);
const ContactDetailPage = lazy(() =>
  import("@features/contacts/pages/contact-detail-page").then((m) => ({
    default: m.ContactDetailPage,
  })),
);
const ContactsPage = lazy(() =>
  import("@features/contacts/pages/contacts-page").then((m) => ({ default: m.ContactsPage })),
);
const DataRightsPage = lazy(() =>
  import("@features/legal/pages/data-rights-page").then((m) => ({ default: m.DataRightsPage })),
);
const DocumentDetailPage = lazy(() =>
  import("@features/documents/pages/document-detail-page").then((m) => ({
    default: m.DocumentDetailPage,
  })),
);
const DocumentEditorPage = lazy(() =>
  import("@features/documents/pages/document-editor-page").then((m) => ({
    default: m.DocumentEditorPage,
  })),
);
const DocumentsPage = lazy(() =>
  import("@features/documents/pages/documents-page").then((m) => ({ default: m.DocumentsPage })),
);
const EmailInboxPage = lazy(() =>
  import("@features/email/pages/email-inbox-page").then((m) => ({ default: m.EmailInboxPage })),
);
const EntityTimelinePage = lazy(() =>
  import("@features/analytics/pages/entity-timeline-page").then((m) => ({
    default: m.EntityTimelinePage,
  })),
);
const FinancePage = lazy(() =>
  import("@features/finance/pages/finance-page").then((m) => ({ default: m.FinancePage })),
);
const ImportPage = lazy(() =>
  import("@features/data-admin/pages/import-page").then((m) => ({ default: m.ImportPage })),
);
const InteractionsPage = lazy(() =>
  import("@features/interactions/pages/interactions-page").then((m) => ({
    default: m.InteractionsPage,
  })),
);
const NotesPage = lazy(() =>
  import("@features/notes/pages/notes-page").then((m) => ({ default: m.NotesPage })),
);
const OpportunitiesPage = lazy(() =>
  import("@features/opportunities/pages/opportunities-page").then((m) => ({
    default: m.OpportunitiesPage,
  })),
);
const OwnerHomePage = lazy(() =>
  import("@features/owner/pages/owner-home-page").then((m) => ({ default: m.OwnerHomePage })),
);
const OwnerPropertyDetailPage = lazy(() =>
  import("@features/owner/pages/owner-property-detail-page").then((m) => ({
    default: m.OwnerPropertyDetailPage,
  })),
);
const PendingPage = lazy(() =>
  import("@features/pending/pages/pending-page").then((m) => ({ default: m.PendingPage })),
);
const PortalAdminPage = lazy(() =>
  import("@features/documents/pages/portal-admin-page").then((m) => ({
    default: m.PortalAdminPage,
  })),
);
const PortalPublicPage = lazy(() =>
  import("@features/documents/pages/portal-public-page").then((m) => ({
    default: m.PortalPublicPage,
  })),
);
const PrivacyPage = lazy(() =>
  import("@features/legal/pages/privacy-page").then((m) => ({ default: m.PrivacyPage })),
);
const SettingsPage = lazy(() =>
  import("@features/settings/pages/settings-page").then((m) => ({ default: m.SettingsPage })),
);
const SharePublicPage = lazy(() =>
  import("@features/documents/pages/share-public-page").then((m) => ({
    default: m.SharePublicPage,
  })),
);
const TasksPage = lazy(() =>
  import("@features/tasks/pages/tasks-page").then((m) => ({ default: m.TasksPage })),
);
const VisitorRegistrationPage = lazy(() =>
  import("@features/visitor-registration/pages/visitor-registration-page").then((m) => ({
    default: m.VisitorRegistrationPage,
  })),
);
const WorkflowsPage = lazy(() =>
  import("@features/workflows/pages/workflows-page").then((m) => ({ default: m.WorkflowsPage })),
);

const VIEW_HOME_PATHS: Record<UserView, string> = {
  admin: "/admin",
  "admin-dev": "/admin",
  agent: "/agent",
  owner: "/owner",
  buyer: "/buyer",
  content: "/content",
};

function ViewRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return <AppSkeleton />;
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={VIEW_HOME_PATHS[user.view] ?? "/admin"} replace />;
}

// LANDOWNER omitted: those users have view "owner" and are routed to the real
// /owner experience; a generic /landowner route only ever rendered a blank page.
const ROLE_ROUTES: UserRole[] = ["ADMIN", "AGENT", "BUYER", "CONTENT"];

export function AppRouter() {
  return (
    // A lazy page resolves in a tick from cache, so the fallback is only ever
    // seen on a cold chunk fetch. AppSkeleton is the same shell ProtectedRoute
    // shows while auth resolves, which keeps the transition from flashing.
    <PageMetaProvider>
      <Suspense fallback={<AppSkeleton />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/auth/setup" element={<AuthSetupPage />} />
          <Route path="/auth/recovery" element={<AuthSetupPage />} />
          <Route path="/" element={<ViewRedirect />} />

          <Route path="/r/:slug" element={<SharePublicPage />} />
          <Route path="/p/:slug" element={<PortalPublicPage />} />
          <Route path="/privacidad" element={<PrivacyPage />} />
          <Route path="/derechos" element={<DataRightsPage />} />
          <Route path="/invitacion/:slug" element={<VisitorRegistrationPage />} />

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
              <Route
                index
                element={
                  role === "ADMIN" || role === "AGENT" ? <AdminHomePage /> : <EmptyDashboard />
                }
              />

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

              {(role === "ADMIN" || role === "AGENT" || role === "CONTENT") && (
                <Route
                  path="pendientes"
                  element={
                    <ProtectedRoute requiredScope="pendientes">
                      <PendingPage />
                    </ProtectedRoute>
                  }
                />
              )}
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

              {(role === "ADMIN" || role === "AGENT") && (
                <>
                  {/* The backend already authorises AGENT on GET/POST/PATCH of
                    properties (properties/router.py); only the frontend was
                    keeping brokers out of their own portfolio. */}
                  <Route path="properties" element={<AdminPropertiesPage />} />
                  <Route path="properties/:id" element={<AdminPropertyDetailPage />} />
                  <Route
                    path="bandeja"
                    element={
                      <ProtectedRoute requiredScope="crm">
                        <BandejaPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="personas"
                    element={
                      <ProtectedRoute requiredScope="crm">
                        <ContactsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="personas/:id"
                    element={
                      <ProtectedRoute requiredScope="crm">
                        <ContactDetailPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="interacciones"
                    element={
                      <ProtectedRoute requiredScope="crm">
                        <InteractionsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="oportunidades"
                    element={
                      <ProtectedRoute requiredScope="crm">
                        <OpportunitiesPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="tareas"
                    element={
                      <ProtectedRoute requiredScope="productividad">
                        <TasksPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="calendario"
                    element={
                      <ProtectedRoute requiredScope="productividad">
                        <CalendarPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="notas"
                    element={
                      <ProtectedRoute requiredScope="productividad">
                        <NotesPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="correos"
                    element={
                      <ProtectedRoute requiredScope="email">
                        <EmailInboxPage />
                      </ProtectedRoute>
                    }
                  />
                </>
              )}

              <Route
                path="workflows"
                element={
                  <ProtectedRoute requiredScope="workflows">
                    <WorkflowsPage />
                  </ProtectedRoute>
                }
              />
              <Route path="timeline/:table/:id" element={<EntityTimelinePage />} />
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
                  <Route
                    path="finanzas"
                    element={
                      <ProtectedRoute requiredScope="finanzas">
                        <FinancePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="datos/importar"
                    element={
                      <ProtectedRoute requiredScope="datos">
                        <ImportPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="users" element={<AdminUsersPage />} />
                  <Route path="users/:id" element={<AdminUserDetailPage />} />
                  <Route
                    path="tenants"
                    element={
                      <ProtectedRoute requiredDevAdmin>
                        <AdminTenantsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="visitantes" element={<AdminVisitorInvitationsPage />} />
                </>
              )}
            </Route>
          ))}

          <Route
            path="/owner"
            element={
              <ProtectedRoute requiredView={["owner", "admin-dev"]}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<OwnerHomePage />} />
            <Route path="properties/:id" element={<OwnerPropertyDetailPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </PageMetaProvider>
  );
}

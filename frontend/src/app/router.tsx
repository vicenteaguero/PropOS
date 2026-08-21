import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
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
import { LEGACY_AGENDA_ROUTES, LEGACY_CLIENT_ROUTES } from "@app/legacy-routes";

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
const EntityTimelinePage = lazy(() =>
  import("@features/analytics/pages/entity-timeline-page").then((m) => ({
    default: m.EntityTimelinePage,
  })),
);
const ImportPage = lazy(() =>
  import("@features/data-admin/pages/import-page").then((m) => ({ default: m.ImportPage })),
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
const AgentPoliciesPage = lazy(() =>
  import("@features/settings/pages/agent-policies-page").then((m) => ({
    default: m.AgentPoliciesPage,
  })),
);
const ClientsCatalogsPage = lazy(() =>
  import("@features/settings/pages/clients-catalogs-page").then((m) => ({
    default: m.ClientsCatalogsPage,
  })),
);
const SharePublicPage = lazy(() =>
  import("@features/documents/pages/share-public-page").then((m) => ({
    default: m.SharePublicPage,
  })),
);
const VisitorRegistrationPage = lazy(() =>
  import("@features/visitor-registration/pages/visitor-registration-page").then((m) => ({
    default: m.VisitorRegistrationPage,
  })),
);
const WorkflowsPage = lazy(() =>
  import("@features/workflows/pages/workflows-page").then((m) => ({ default: m.WorkflowsPage })),
);

// Section shells. Each hosts the former sibling pages as tabs; see
// shared/ui/section-tabs.tsx for why the tab lives in a query param.
const DealDetailPage = lazy(() =>
  import("@features/deals/pages/deal-detail-page").then((m) => ({ default: m.DealDetailPage })),
);
const ClientsSectionPage = lazy(() =>
  import("@features/sections/pages/clients-section-page").then((m) => ({
    default: m.ClientsSectionPage,
  })),
);
const AgendaSectionPage = lazy(() =>
  import("@features/sections/pages/agenda-section-page").then((m) => ({
    default: m.AgendaSectionPage,
  })),
);
const FinanceSectionPage = lazy(() =>
  import("@features/sections/pages/finance-section-page").then((m) => ({
    default: m.FinanceSectionPage,
  })),
);
const DocumentsSectionPage = lazy(() =>
  import("@features/sections/pages/documents-section-page").then((m) => ({
    default: m.DocumentsSectionPage,
  })),
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

/**
 * `/:role/properties/:id` → `/:role/propiedades/:id`, keeping the id.
 *
 * A plain `<Navigate>` cannot do this: the target depends on a path param, so
 * the redirect has to read it. Property links were shared and pushed for
 * months under the English path.
 */
function PropertyDetailRedirect() {
  const { id } = useParams();
  return <Navigate to={`../propiedades/${id}`} replace />;
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

              {/* ---- Sections ----
                  Four destinations replace fifteen sibling list routes. Detail
                  routes deliberately keep their original paths: they are what
                  every navigate() call and every shared link already points at,
                  and nesting them under the section would have bought nothing.
                  The old list paths below redirect into the right tab. */}
              {(role === "ADMIN" || role === "AGENT") && (
                <>
                  <Route path="clientes" element={<ClientsSectionPage />} />
                  <Route path="agenda" element={<AgendaSectionPage />} />
                  <Route
                    path="personas/:id"
                    element={
                      <ProtectedRoute requiredScope="crm">
                        <ContactDetailPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="propiedades/:id" element={<AdminPropertyDetailPage />} />
                  <Route
                    path="negocios/:id"
                    element={
                      <ProtectedRoute requiredScope="crm">
                        <DealDetailPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Every path this section has ever had, from one table so
                      the test can assert against the real router rather than a
                      hand-built copy of it. See app/legacy-routes.ts. */}
                  {LEGACY_CLIENT_ROUTES.map(({ from, to }) => (
                    <Route key={from} path={from} element={<Navigate to={to} replace />} />
                  ))}
                  <Route path="properties/:id" element={<PropertyDetailRedirect />} />
                  {LEGACY_AGENDA_ROUTES.map(({ from, to }) => (
                    <Route key={from} path={from} element={<Navigate to={to} replace />} />
                  ))}
                </>
              )}

              {/* BUYER and CONTENT never had a CRM; their inbox is the only
                  conversation surface they can reach. */}
              {(role === "BUYER" || role === "CONTENT") && (
                <Route
                  path="client-inbox"
                  element={
                    <ProtectedRoute requiredScope="inbox">
                      <ClientInboxPage />
                    </ProtectedRoute>
                  }
                />
              )}

              <Route
                path="documentos"
                element={
                  <ProtectedRoute requiredScope="documents">
                    <DocumentsSectionPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="documents"
                element={<Navigate to="../documentos?tab=archivos" replace />}
              />
              <Route
                path="documents/portals"
                element={<Navigate to="../documentos?tab=enlaces" replace />}
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
              {role === "ADMIN" && <Route path="settings" element={<SettingsPage />} />}
              {/* What Propo may do without a human. Its own page under
                  Configuración; the backend gates it on ADMIN too. */}
              {role === "ADMIN" && <Route path="settings/propo" element={<AgentPoliciesPage />} />}
              {/* The two Clientes catalogs — message templates and closing
                  checklists. ADMIN at the router, same as the backend. */}
              {role === "ADMIN" && (
                <Route path="settings/clientes" element={<ClientsCatalogsPage />} />
              )}

              {role === "ADMIN" && (
                <>
                  <Route
                    path="finanzas"
                    element={
                      <ProtectedRoute requiredScope="finanzas">
                        <FinanceSectionPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="analytics"
                    element={<Navigate to="../finanzas?tab=analitica" replace />}
                  />
                  <Route
                    path="analytics/agent-cost"
                    element={<Navigate to="../finanzas?tab=costo-propo" replace />}
                  />
                  <Route
                    path="phones"
                    element={
                      <ProtectedRoute requiredScope="phones">
                        <AdminPhonesPage />
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

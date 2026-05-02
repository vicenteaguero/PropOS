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
import { AnitaCostPage } from "@features/analytics/pages/anita-cost-page";
import { EntityTimelinePage } from "@features/analytics/pages/entity-timeline-page";
import { WorkflowsPage } from "@features/workflows/pages/workflows-page";
import { GenericApiTablePage } from "@shared/components/generic-api-table/generic-api-table-page";
import { formatCLP } from "@/lib/locale-cl";
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

const PEOPLE_COLS = [
  { key: "full_name", label: "Nombre" },
  { key: "type", label: "Tipo" },
  { key: "phone", label: "Teléfono" },
  { key: "email", label: "Email" },
];
const INTERACTION_COLS = [
  { key: "occurred_at", label: "Fecha" },
  { key: "kind", label: "Tipo" },
  { key: "summary", label: "Resumen" },
  { key: "source", label: "Origen" },
];
const TASK_COLS = [
  { key: "title", label: "Título" },
  { key: "kind", label: "Tipo" },
  { key: "status", label: "Estado" },
  { key: "due_at", label: "Vence" },
  { key: "priority", label: "Prio" },
];
const TX_COLS = [
  { key: "occurred_at", label: "Fecha" },
  { key: "direction", label: "↕" },
  { key: "category", label: "Categoría" },
  {
    key: "amount_cents",
    label: "Monto",
    format: (v: unknown) => (typeof v === "number" ? formatCLP(v / 100) : "—"),
  },
  { key: "description", label: "Descripción" },
];
const PROPERTY_COLS = [
  { key: "title", label: "Título" },
  { key: "status", label: "Estado" },
  { key: "address", label: "Dirección" },
  {
    key: "list_price_cents",
    label: "Precio",
    format: (v: unknown) => (typeof v === "number" ? formatCLP(v / 100) : "—"),
  },
];
const PROJECT_COLS = [
  { key: "name", label: "Nombre" },
  { key: "kind", label: "Tipo" },
  { key: "status", label: "Estado" },
];
const OPP_COLS = [
  { key: "pipeline_stage", label: "Stage" },
  { key: "status", label: "Estado" },
  {
    key: "expected_value_cents",
    label: "Valor esperado",
    format: (v: unknown) => (typeof v === "number" ? formatCLP(v / 100) : "—"),
  },
  { key: "expected_close_at", label: "Cierre esperado" },
];
const PUB_COLS = [
  { key: "property_id", label: "Propiedad" },
  { key: "portal_org_id", label: "Portal" },
  { key: "status", label: "Estado" },
  { key: "external_url", label: "URL" },
];
const CAMPAIGN_COLS = [
  { key: "name", label: "Nombre" },
  { key: "channel", label: "Canal" },
  { key: "status", label: "Estado" },
  {
    key: "budget_cents",
    label: "Presupuesto",
    format: (v: unknown) => (typeof v === "number" ? formatCLP(v / 100) : "—"),
  },
];
const ORG_COLS = [
  { key: "name", label: "Nombre" },
  { key: "kind", label: "Tipo" },
  { key: "phone", label: "Teléfono" },
  { key: "email", label: "Email" },
];
const TAG_COLS = [
  { key: "name", label: "Nombre" },
  { key: "color", label: "Color" },
];

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

          <Route path="pendientes" element={<PendingPage />} />

          <Route
            path="personas"
            element={
              <GenericApiTablePage
                title="Personas"
                description="Contactos, propietarios, compradores, notarías, equipo, stakeholders."
                endpoint="/v1/contacts"
                columns={PEOPLE_COLS}
              />
            }
          />
          <Route
            path="interacciones"
            element={
              <GenericApiTablePage
                title="Interacciones"
                description="Visitas, llamadas, notas, emails, reuniones, showings."
                endpoint="/v1/interactions"
                columns={INTERACTION_COLS}
              />
            }
          />
          <Route
            path="tareas"
            element={
              <GenericApiTablePage
                title="Tareas"
                description="ToDos, pendientes, goals, objetivos, planes."
                endpoint="/v1/tasks"
                columns={TASK_COLS}
              />
            }
          />
          <Route
            path="transacciones"
            element={
              <GenericApiTablePage
                title="Transacciones"
                description="Gastos, costos, boletas, ad spend, ingresos."
                endpoint="/v1/transactions"
                columns={TX_COLS}
              />
            }
          />
          <Route
            path="propiedades"
            element={
              <GenericApiTablePage
                title="Propiedades"
                endpoint="/v1/properties"
                columns={PROPERTY_COLS}
              />
            }
          />
          <Route
            path="proyectos"
            element={
              <GenericApiTablePage
                title="Proyectos"
                description="Parcelaciones, comerciales, residenciales, etc."
                endpoint="/v1/projects"
                columns={PROJECT_COLS}
              />
            }
          />
          <Route
            path="oportunidades"
            element={
              <GenericApiTablePage
                title="Oportunidades"
                endpoint="/v1/opportunities"
                columns={OPP_COLS}
              />
            }
          />
          <Route
            path="publicaciones"
            element={
              <GenericApiTablePage
                title="Publicaciones en portales"
                endpoint="/v1/publications"
                columns={PUB_COLS}
              />
            }
          />
          <Route
            path="campanas"
            element={
              <GenericApiTablePage
                title="Campañas publicitarias"
                endpoint="/v1/campaigns"
                columns={CAMPAIGN_COLS}
              />
            }
          />
          <Route
            path="organizaciones"
            element={
              <GenericApiTablePage
                title="Organizaciones"
                description="Notarías, portales, bancos, agencias."
                endpoint="/v1/organizations"
                columns={ORG_COLS}
              />
            }
          />
          <Route
            path="tags"
            element={<GenericApiTablePage title="Tags" endpoint="/v1/tags" columns={TAG_COLS} />}
          />

          <Route path="workflows" element={<WorkflowsPage />} />
          <Route path="timeline/:table/:id" element={<EntityTimelinePage />} />

          {role === "ADMIN" && (
            <>
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="analytics/anita-cost" element={<AnitaCostPage />} />
            </>
          )}
        </Route>
      ))}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

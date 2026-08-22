import {
  Building2,
  CalendarDays,
  FileText,
  Home,
  Inbox,
  ListChecks,
  MessageSquareText,
  Phone,
  Receipt,
  Shield,
  Settings,
  Sparkles,
  ToggleLeft,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { UserView } from "@shared/types/auth";
import { isVisible, type FeatureMap } from "@shared/feature/catalog";

/**
 * The single navigation tree, shared by the desktop sidebar and the mobile
 * "Más" sheet.
 *
 * It used to live inside app-sidebar.tsx, which meant the phone shell could
 * only reach whatever the bottom nav and the home tiles happened to hardcode —
 * 9 of 24 admin destinations, with Pendientes (the AI proposal queue) among the
 * 13 that were URL-only. Anything added here now surfaces on both shells.
 */

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: "pending";
  scope?: string;
  /**
   * Feature key from `shared/feature/catalog`. Orthogonal to `scope`: the scope
   * asks whether this person may, the feature asks whether the brokerage has it
   * turned on. An entry needs to clear both.
   */
  feature?: string;
  devOnly?: boolean;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export function filterByScope(groups: NavGroup[], adminScope: string[]): NavGroup[] {
  if (adminScope.length === 0) return groups;
  const allowed = new Set(adminScope);
  const visible = (item: NavItem) => !item.scope || allowed.has(item.scope);
  return groups
    .map((g) => ({ ...g, items: g.items.filter(visible) }))
    .filter((g) => g.items.length > 0);
}

/**
 * Drop entries whose feature is hidden for this tenant.
 *
 * `locked` deliberately survives: the nav entry stays, and the route it points
 * at renders the locked screen. Hiding a locked feature from the nav would make
 * "locked" and "hidden" the same state.
 */
export function filterByFeature(groups: NavGroup[], features: FeatureMap): NavGroup[] {
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => isVisible(features, i.feature)) }))
    .filter((g) => g.items.length > 0);
}

export function filterByDev(groups: NavGroup[], isDevAdmin: boolean): NavGroup[] {
  if (isDevAdmin) return groups;
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.devOnly) }))
    .filter((g) => g.items.length > 0);
}

/** The one route that hosts everything a broker touches about once a month. */
export const SETTINGS_PATH = "/admin/settings";

export function buildAdminGroups(agentName: string): NavGroup[] {
  // Three groups plus Configuración, not four with a five-item admin block.
  //
  // Importar, Visitantes, Teléfonos, Usuarios, Tenants and Workflows were six
  // permanent nav entries for tasks nobody performs weekly, and they sat at the
  // same visual weight as CRM. They now live as sections INSIDE Configuración
  // (features/settings), which in turn stopped being hardcoded per shell and
  // became a real entry here. Every route is unchanged — this is a change of
  // prominence, not of URLs, so nothing bookmarked breaks.
  return [
    { items: [{ label: "Inicio", path: "/admin", icon: Home, end: true }] },
    {
      label: agentName,
      items: [
        {
          label: agentName,
          path: "/admin/agent",
          icon: Sparkles,
          scope: "agent",
          feature: "agent",
        },
        {
          label: "Pendientes",
          path: "/admin/pendientes",
          icon: Inbox,
          badge: "pending",
          scope: "pendientes",
          feature: "pendientes",
        },
      ],
    },
    {
      label: "Trabajo",
      items: [
        { label: "Clientes", path: "/admin/clientes", icon: Users, scope: "crm", feature: "crm" },
        {
          label: "Agenda",
          path: "/admin/agenda",
          icon: CalendarDays,
          scope: "productividad",
          feature: "productividad",
        },
        {
          label: "Propiedades",
          path: "/admin/clientes?tab=propiedades",
          icon: Building2,
          feature: "propiedades",
        },
        {
          label: "Documentos",
          path: "/admin/documentos",
          icon: FileText,
          scope: "documents",
          feature: "documents",
        },
        {
          label: "Finanzas",
          path: "/admin/finanzas",
          icon: Receipt,
          scope: "finanzas",
          feature: "finanzas",
        },
      ],
    },
    // Stays in the tree so the title index, the mobile sheet and the desktop
    // rail all agree it exists. AppSidebar filters it out of the scrolling list
    // and renders it in the footer instead, beside sign-out.
    { items: [{ label: "Configuración", path: SETTINGS_PATH, icon: Settings }] },
  ];
}

/**
 * The destinations Configuración now owns, in the order the page lists them.
 * Exported as data so the settings page and any future surface cannot drift
 * from each other the way the two shells' hardcoded copies did.
 */
export function buildSettingsShortcuts(agentName: string): NavItem[] {
  return [
    { label: "Usuarios", path: "/admin/users", icon: Users },
    // Plantillas de WhatsApp + listas de cierre. Both are tables precisely so
    // that editing one is not a deploy; without a destination here they stayed
    // as unreachable as the constants they replaced.
    { label: "Clientes", path: "/admin/settings/clientes", icon: MessageSquareText },
    { label: "Visitantes", path: "/admin/visitantes", icon: UserPlus },
    { label: "Teléfonos", path: "/admin/phones", icon: Phone, scope: "phones", feature: "phones" },
    {
      label: "Importar datos",
      path: "/admin/datos/importar",
      icon: Upload,
      scope: "datos",
      feature: "datos",
    },
    {
      label: "Workflows",
      path: "/admin/workflows",
      icon: ListChecks,
      scope: "workflows",
      feature: "workflows",
    },
    {
      label: `Costo ${agentName}`,
      path: "/admin/finanzas?tab=costo-propo",
      icon: Receipt,
      scope: "analytics",
      devOnly: true,
    },
    { label: "Tenants", path: "/admin/tenants", icon: Shield, devOnly: true },
    {
      label: "Funcionalidades",
      path: "/admin/settings/funcionalidades",
      icon: ToggleLeft,
      devOnly: true,
    },
  ];
}

export function buildOwnerGroups(): NavGroup[] {
  return [
    {
      items: [{ label: "Mis propiedades", path: "/owner", icon: Home, end: true }],
    },
  ];
}

export function buildGroups(view: UserView, agentName: string, isDevAdmin: boolean): NavGroup[] {
  switch (view) {
    case "admin":
    case "admin-dev":
      return filterByDev(buildAdminGroups(agentName), isDevAdmin);
    case "agent":
      return [
        { items: [{ label: "Inicio", path: "/agent", icon: Home, end: true }] },
        {
          label: "Trabajo",
          items: [
            {
              label: "Pendientes",
              path: "/agent/pendientes",
              icon: Inbox,
              badge: "pending",
              feature: "pendientes",
            },
            { label: "Clientes", path: "/agent/clientes", icon: Users, feature: "crm" },
            {
              label: "Agenda",
              path: "/agent/agenda",
              icon: CalendarDays,
              feature: "productividad",
            },
            {
              label: "Propiedades",
              path: "/agent/clientes?tab=propiedades",
              icon: Building2,
              feature: "propiedades",
            },
            {
              label: "Documentos",
              path: "/agent/documentos",
              icon: FileText,
              feature: "documents",
            },
            {
              label: "Workflows",
              path: "/agent/workflows",
              icon: ListChecks,
              feature: "workflows",
            },
          ],
        },
      ];
    case "owner":
      return buildOwnerGroups();
    case "buyer":
      return [
        {
          items: [
            { label: "Inicio", path: "/buyer", icon: Home, end: true },
            {
              label: "Documentos",
              path: "/buyer/documentos",
              icon: FileText,
              feature: "documents",
            },
          ],
        },
      ];
    case "content":
      return [
        {
          items: [
            { label: "Inicio", path: "/content", icon: Home, end: true },
            { label: agentName, path: "/content/pendientes", icon: Sparkles },
          ],
        },
      ];
    default:
      return [];
  }
}

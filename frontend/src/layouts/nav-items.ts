import {
  BarChart3,
  Building2,
  CalendarDays,
  CheckSquare,
  FileText,
  Folder,
  Home,
  Inbox,
  ListChecks,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Receipt,
  Shield,
  Sparkles,
  StickyNote,
  Target,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { UserView } from "@shared/types/auth";

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

export function filterByDev(groups: NavGroup[], isDevAdmin: boolean): NavGroup[] {
  if (isDevAdmin) return groups;
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.devOnly) }))
    .filter((g) => g.items.length > 0);
}

export function buildAdminGroups(agentName: string): NavGroup[] {
  return [
    { items: [{ label: "Inicio", path: "/admin", icon: Home, end: true }] },
    {
      label: agentName,
      items: [
        { label: agentName, path: "/admin/agent", icon: Sparkles, scope: "agent" },
        {
          label: "Pendientes",
          path: "/admin/pendientes",
          icon: Inbox,
          badge: "pending",
          scope: "pendientes",
        },
        {
          label: "Costo",
          path: "/admin/analytics/agent-cost",
          icon: Receipt,
          scope: "analytics",
          devOnly: true,
        },
      ],
    },
    {
      label: "Comunicación",
      items: [
        { label: "Inbox WA", path: "/admin/client-inbox", icon: MessageCircle, scope: "inbox" },
        { label: "Correos", path: "/admin/correos", icon: Mail, scope: "email" },
        { label: "Teléfonos", path: "/admin/phones", icon: Phone, scope: "phones" },
      ],
    },
    {
      label: "CRM",
      items: [
        { label: "Bandeja", path: "/admin/bandeja", icon: Inbox, scope: "crm" },
        { label: "Personas", path: "/admin/personas", icon: Users, scope: "crm" },
        { label: "Interacciones", path: "/admin/interacciones", icon: MessageSquare, scope: "crm" },
        { label: "Oportunidades", path: "/admin/oportunidades", icon: Target, scope: "crm" },
        { label: "Propiedades", path: "/admin/properties", icon: Building2 },
        { label: "Documentos", path: "/admin/documents", icon: FileText, scope: "documents" },
        { label: "Enlaces", path: "/admin/documents/portals", icon: Folder, scope: "documents" },
      ],
    },
    {
      label: "Productividad",
      items: [
        { label: "Tareas", path: "/admin/tareas", icon: CheckSquare, scope: "productividad" },
        {
          label: "Calendario",
          path: "/admin/calendario",
          icon: CalendarDays,
          scope: "productividad",
        },
        { label: "Notas", path: "/admin/notas", icon: StickyNote, scope: "productividad" },
      ],
    },
    {
      label: "Operación",
      items: [
        { label: "Workflows", path: "/admin/workflows", icon: ListChecks, scope: "workflows" },
        { label: "Finanzas", path: "/admin/finanzas", icon: Receipt, scope: "finanzas" },
        { label: "Analítica", path: "/admin/analytics", icon: BarChart3, scope: "analytics" },
      ],
    },
    {
      label: "Administración",
      items: [
        { label: "Usuarios", path: "/admin/users", icon: Users },
        { label: "Visitantes", path: "/admin/visitantes", icon: UserPlus },
        { label: "Importar", path: "/admin/datos/importar", icon: Upload, scope: "datos" },
      ],
    },
    {
      label: "Sistema",
      items: [{ label: "Tenants", path: "/admin/tenants", icon: Shield, devOnly: true }],
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
            { label: "Pendientes", path: "/agent/pendientes", icon: Inbox, badge: "pending" },
            { label: "Tareas", path: "/agent/tareas", icon: CheckSquare },
            { label: "Calendario", path: "/agent/calendario", icon: CalendarDays },
            { label: "Notas", path: "/agent/notas", icon: StickyNote },
            { label: "Workflows", path: "/agent/workflows", icon: ListChecks },
          ],
        },
        {
          label: "CRM",
          items: [
            { label: "Bandeja", path: "/agent/bandeja", icon: Inbox },
            { label: "Personas", path: "/agent/personas", icon: Users },
            { label: "Interacciones", path: "/agent/interacciones", icon: MessageSquare },
            { label: "Oportunidades", path: "/agent/oportunidades", icon: Target },
            // Backend authorizes AGENT on /properties (properties/router.py),
            // so the role gets the same CRM entry ADMIN has.
            { label: "Propiedades", path: "/agent/properties", icon: Building2 },
            { label: "Inbox WA", path: "/agent/client-inbox", icon: MessageCircle },
            { label: "Correos", path: "/agent/correos", icon: Mail },
          ],
        },
        {
          label: "Datos",
          items: [
            { label: "Documentos", path: "/agent/documents", icon: FileText },
            { label: "Enlaces", path: "/agent/documents/portals", icon: Folder },
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
            { label: "Documentos", path: "/buyer/documents", icon: FileText },
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

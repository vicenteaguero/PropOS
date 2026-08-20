import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, LogOut, Moon, Settings, Sparkles, Sun, User, Check } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@shared/hooks/use-auth";
import { useThemeMode } from "@core/theme/theme-provider";
import { useAgentName } from "@core/branding/agent-branding";
import { useNavGroups } from "@layouts/use-nav-groups";
import { useAgentOverlay } from "@features/agent/components/agent-overlay-host";
import { useEntitySearch, type EntityHit, type EntityKind } from "@shared/api/entity-search";
import { useDebounced } from "@shared/hooks/use-debounced";

/**
 * Returns true when focus is somewhere the user is typing prose, so a bare
 * shortcut key must not steal it. Modifier combos (⌘K) are always safe.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/**
 * Opens on ⌘K / Ctrl+K anywhere, and on a bare `/` when the user is not typing.
 * Returns the open state plus a setter for the trigger button to share.
 */
export function useCommandPaletteHotkey(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const combo = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      const slash = e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey;
      if (combo || (slash && !isTypingTarget(e.target))) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return [open, setOpen];
}

/**
 * The app's jump-to-anything surface.
 *
 * `cmdk` and `ui/command.tsx` shipped months ago but only ever backed one
 * entity picker; the header's "command bar" was a Propo launcher that rendered
 * `null` for anyone who was not an admin, so the AGENT role had no quick
 * navigation at all and everybody else had exactly two shortcuts in the whole
 * product. This is the real thing: every destination the user's role can reach,
 * the workspace switcher, the theme toggle, and Propo when they're entitled to
 * it — one keystroke from anywhere, on every viewport.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { user, memberships, switchTenant, signOut } = useAuth();
  const { theme, toggle } = useThemeMode();
  const agentName = useAgentName();
  const { groups, isAdminView } = useNavGroups();
  const propo = useAgentOverlay();
  const [query, setQuery] = useState("");
  // Two characters is where a name search stops matching half the database.
  const term = useDebounced(query.trim(), 200);
  const searching = term.length >= 2;

  const roleRoot = `/${(user?.role ?? "ADMIN").toLowerCase()}`;
  // Two kinds, not three. Opportunities have no page of their own — every hit
  // landed on the same board — and resolving one costs a join through people
  // and properties, so the palette ended up waiting on its slowest query for a
  // result that told the user nothing.
  const people = useEntitySearch("CONTACT", term, searching);
  const properties = useEntitySearch("PROPERTY", term, searching);

  const records: { hit: EntityHit; to: string }[] = useMemo(() => {
    if (!searching) return [];
    const path: Record<EntityKind, (id: string) => string> = {
      CONTACT: (id) => `${roleRoot}/personas/${id}`,
      PROPERTY: (id) => `${roleRoot}/properties/${id}`,
      OPPORTUNITY: () => `${roleRoot}/clientes?tab=negocios`,
      EVENT: () => `${roleRoot}/agenda`,
      PROJECT: () => `${roleRoot}/clientes?tab=propiedades`,
      PLACE: () => `${roleRoot}/clientes?tab=propiedades`,
    };
    return [...(people.data ?? []), ...(properties.data ?? [])]
      .slice(0, 12)
      .map((hit) => ({ hit, to: path[hit.kind](hit.id) }));
  }, [searching, people.data, properties.data, roleRoot]);

  const canPropo = useMemo(() => {
    if (!isAdminView) return false;
    const scope = user?.adminScope ?? [];
    return scope.length === 0 || scope.includes("agent");
  }, [isAdminView, user?.adminScope]);

  const run = useCallback(
    (fn: () => void) => {
      onOpenChange(false);
      fn();
    },
    [onOpenChange],
  );
  if (!user) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="top-[12%] max-w-xl translate-y-0 overflow-hidden p-0"
        >
          <DialogTitle className="sr-only">Buscar y navegar</DialogTitle>
          <Command loop>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Buscar una persona, una propiedad, una página…"
            />
            <CommandList className="max-h-[60dvh]">
              <CommandEmpty>Sin resultados.</CommandEmpty>

              {records.length > 0 && (
                <CommandGroup heading="Registros">
                  {records.map(({ hit, to }) => {
                    const Icon = hit.kind === "CONTACT" ? User : Building2;
                    return (
                      <CommandItem
                        key={`${hit.kind}-${hit.id}`}
                        // cmdk scores against `value`; the server already
                        // decided these match, so the term itself is included
                        // to keep them from being filtered back out.
                        value={`${hit.label} ${hit.sub ?? ""} ${term}`}
                        onSelect={() => run(() => navigate(to))}
                      >
                        <Icon className="size-4" />
                        <span className="truncate">{hit.label}</span>
                        {hit.sub && (
                          <span className="ml-auto truncate text-xs text-muted-foreground">
                            {hit.sub}
                          </span>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}

              {canPropo && (
                <CommandGroup heading={agentName}>
                  <CommandItem
                    value={`${agentName} preguntar asistente ia`}
                    onSelect={() => run(() => propo.open())}
                  >
                    <Sparkles className="size-4" />
                    Pedirle algo a {agentName}
                  </CommandItem>
                </CommandGroup>
              )}

              {groups.map((group, idx) => (
                <CommandGroup key={group.label ?? `g-${idx}`} heading={group.label ?? "Ir a"}>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <CommandItem
                        key={item.path}
                        // cmdk matches on `value`; the path is in there so
                        // typing "personas" or "/admin/personas" both land.
                        value={`${item.label} ${item.path}`}
                        onSelect={() => run(() => navigate(item.path))}
                      >
                        <Icon className="size-4" />
                        {item.label}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}

              {memberships.length > 1 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Espacio de trabajo">
                    {memberships.map((m) => {
                      const active = m.tenantId === user.tenantId;
                      const name = m.tenantName ?? m.tenantSlug ?? m.tenantId;
                      return (
                        <CommandItem
                          key={m.tenantId}
                          value={`workspace ${name}`}
                          onSelect={() => run(() => !active && void switchTenant(m.tenantId))}
                        >
                          <span className="size-2.5 rounded-full bg-primary" />
                          {name}
                          {active && <Check className="ml-auto size-3.5" />}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </>
              )}

              <CommandSeparator />
              <CommandGroup heading="Acciones">
                <CommandItem value="tema claro oscuro apariencia" onSelect={() => run(toggle)}>
                  {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
                  {theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                </CommandItem>
                {isAdminView && (
                  <CommandItem
                    value="configuración ajustes settings"
                    onSelect={() => run(() => navigate("/admin/settings"))}
                  >
                    <Settings className="size-4" />
                    Configuración
                  </CommandItem>
                )}
                <CommandItem value="cerrar sesión salir logout" onSelect={() => run(signOut)}>
                  <LogOut className="size-4" />
                  Cerrar sesión
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}

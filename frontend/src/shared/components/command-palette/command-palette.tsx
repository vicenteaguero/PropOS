import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Moon, Settings, Sparkles, Sun, Check } from "lucide-react";
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
import { AgentOverlay } from "@features/agent/components/agent-overlay";

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
  const [propoOpen, setPropoOpen] = useState(false);

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
            <CommandInput placeholder="Ir a una página, cambiar de workspace, ejecutar una acción…" />
            <CommandList className="max-h-[60dvh]">
              <CommandEmpty>Sin resultados.</CommandEmpty>

              {canPropo && (
                <CommandGroup heading={agentName}>
                  <CommandItem
                    value={`${agentName} preguntar asistente ia`}
                    onSelect={() => run(() => setPropoOpen(true))}
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

      {canPropo && propoOpen && <AgentOverlay onClose={() => setPropoOpen(false)} />}
    </>
  );
}

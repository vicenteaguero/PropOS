import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Check,
  FileText,
  Home,
  LayoutGrid,
  LogOut,
  Moon,
  Receipt,
  Settings,
  Sun,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@shared/hooks/use-auth";
import { useThemeMode } from "@core/theme/theme-provider";
import { tenantSwatch } from "@core/theme/tenant-accent";
import { useAgentOverlay } from "@features/agent/components/agent-overlay-host";
import { BottomSheet, Pill, PropoMark } from "@shared/ui";
import { useUnreadCount } from "@features/attention/hooks/use-unread";
import { useNavGroups, usePendingCount } from "@layouts/use-nav-groups";
import { useIsImmersive } from "@layouts/immersive";
import { SETTINGS_PATH } from "@layouts/nav-items";
import { prefetchRoute } from "@shared/lib/route-chunks";
import { cn } from "@/lib/utils";
import type { UserView } from "@shared/types/auth";
import { BuildStampRow } from "@core/version/build-stamp-row";
import { shortName } from "@shared/utils/display-name";
import { initials } from "@shared/utils/format";

/**
 * The metrics every slot in the nav shares.
 *
 * The icon grew 22 → 24 and the label shrank 10 → 9.5 without the bar getting
 * taller: at 22px the glyphs were the smallest thing on a screen you use at
 * arm's length, and the label under them is a reminder, not a heading.
 */
const NAV_ICON = "size-[24px]";
const NAV_LABEL = "text-[9.5px] leading-tight";

const NAV_SLOT = "relative flex min-w-0 flex-1 flex-col items-center gap-0.5 py-1";

/** The inside of a slot, so the link and the button versions cannot drift. */
function NavTabBody({
  icon: Icon,
  label,
  active,
  badge,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  badge?: boolean;
}) {
  return (
    <>
      <Icon
        className={cn(NAV_ICON, active ? "text-foreground" : "text-muted-foreground")}
        strokeWidth={active ? 2.2 : 1.8}
      />
      {badge && (
        <span
          aria-hidden
          className="absolute right-[calc(50%-16px)] top-0 size-2 rounded-full bg-primary"
        />
      )}
      <span
        className={cn(
          "max-w-full truncate",
          NAV_LABEL,
          active ? "font-bold text-foreground" : "font-medium text-muted-foreground",
        )}
      >
        {label}
      </span>
    </>
  );
}

function NavTab({
  to,
  end,
  icon,
  label,
  as,
  onClick,
  ariaLabel,
  badge,
}: {
  to?: string;
  end?: boolean;
  icon: LucideIcon;
  label: string;
  /** "Más" opens a sheet rather than navigating, so it is a button. */
  as?: "button";
  onClick?: () => void;
  ariaLabel?: string;
  badge?: boolean;
}) {
  if (as === "button") {
    return (
      <button type="button" onClick={onClick} aria-label={ariaLabel} className={NAV_SLOT}>
        <NavTabBody icon={icon} label={label} active={false} badge={badge} />
      </button>
    );
  }
  return (
    <NavLink to={to!} end={end} className={NAV_SLOT}>
      {({ isActive }) => <NavTabBody icon={icon} label={label} active={isActive} badge={badge} />}
    </NavLink>
  );
}

/**
 * Publishes the nav's rendered height to `--app-nav-h` on <html> and clears it
 * on unmount. Measuring beats a constant: the nav loses tabs when a role lacks
 * a scope, and its bottom pad is `env(safe-area-inset-bottom)`, which differs
 * per device and is 0 in the browser but ~34px in the installed PWA.
 */
function usePublishNavHeight(ref: React.RefObject<HTMLElement | null>, hidden: boolean) {
  useEffect(() => {
    const root = document.documentElement;
    // Hidden is not "unchanged": every pinned surface subtracts this token, so
    // a nav that is not on screen has to report 0 rather than its last height.
    if (hidden) {
      root.style.setProperty("--app-nav-h", "0px");
      return;
    }
    const el = ref.current;
    if (!el) return;
    const publish = () => root.style.setProperty("--app-nav-h", `${el.offsetHeight}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--app-nav-h");
    };
  }, [ref, hidden]);
}

export function MobileBottomNav() {
  const { user, memberships, switchTenant, signOut } = useAuth();
  const { theme, toggle } = useThemeMode();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const propo = useAgentOverlay();
  const { groups } = useNavGroups();
  const pendingCount = usePendingCount();
  const unreadCount = useUnreadCount();
  const navRef = useRef<HTMLElement>(null);
  const immersive = useIsImmersive();
  usePublishNavHeight(navRef, immersive);

  if (!user) return null;
  // An open conversation owns the whole screen (see useImmersive).
  if (immersive) return null;

  const base = `/${user.role.toLowerCase()}`;
  const view = (user.view as UserView | undefined) ?? "agent";
  const isAdminView = view === "admin" || view === "admin-dev";
  const scopes = user.adminScope ?? [];
  const allow = (scope?: string) => !scope || scopes.length === 0 || scopes.includes(scope);
  // Propo (agent pipeline) is backend ADMIN-only.
  const canPropo = isAdminView && allow("agent");

  // The sheet lists what the chrome around it cannot already reach. Repeating
  // Inicio, Clientes and Agenda would spend the top of the sheet on destinations the
  // user has permanently under their thumb; Propo is the centre FAB, two
  // centimetres below the sheet's own edge; and Configuración is the gear in
  // this sheet's header. A twelve-button grid where a third of the buttons are
  // duplicates is what made every entry look equally (un)important.
  // Documentos and Finanzas are driven off the nav tree rather than a second
  // copy of the guard logic: `useNavGroups` has already dropped what this role
  // may not open, what this person's scope excludes, and what the tenant has
  // switched off. Asking "is this path in the tree" answers all three at once,
  // and cannot drift from the sidebar the way a hand-written `allow()` would.
  const reachable = new Set(groups.flatMap((g) => g.items.map((i) => i.path)));
  const docsPath = `${base}/documentos`;
  const financePath = `${base}/finanzas`;

  const chromePaths = new Set([
    base,
    `${base}/clientes`,
    `${base}/agenda`,
    `${base}/agent`,
    docsPath,
    financePath,
    SETTINGS_PATH,
  ]);
  const sheetGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !chromePaths.has(i.path)) }))
    .filter((g) => g.items.length > 0);

  // `replace` because the sheet already pushed a duplicate history entry for the
  // current URL (see useDismissOnBack). Replacing it keeps Back meaning "the page
  // I came from" instead of costing two presses to leave.
  const go = (path: string) => {
    navigate(path, { replace: true });
    setMoreOpen(false);
  };

  return (
    <>
      {/* z-50 so transient bottom-anchored chrome (the iOS install nudge) can
          never bury the only navigation this shell has. */}
      {/* Propo covers the screen, so the nav must not sit on top of it. Kept
          mounted and merely invisible: unmounting would drop --app-nav-h to 0
          and reflow every page behind the overlay, then reflow it back on
          close. `invisible` keeps the box measured and the value stable. */}
      <nav
        ref={navRef}
        aria-label="Navegación principal"
        aria-hidden={propo.isOpen}
        className={`fixed inset-x-0 bottom-0 z-50 pt-1.5 ${propo.isOpen ? "invisible" : ""} pb-[calc(var(--safe-bottom)+0.75rem)] pl-[calc(var(--safe-left)+0.875rem)] pr-[calc(var(--safe-right)+0.875rem)]`}
      >
        {/* A floating pill, not a bar. It used to span the full frame, which on a
            phone reads as a wall across the bottom of every screen and pins the
            thumb to the extreme corners.

            It held five targets at ~19rem; it now holds seven — three, the FAB,
            three — so the cap moves to 26rem. That is still short of the frame
            on any phone, so the pill keeps reading as a floating object, but it
            gives each of the seven ~3.4rem instead of ~2.7rem, which is what
            "Finanzas" needs at 10px before it truncates.

            Translucent over a blur so the page scrolling underneath stays
            legible as motion instead of disappearing behind an opaque slab. */}
        <div className="mx-auto flex w-full max-w-[26rem] items-center justify-around rounded-[var(--radius-4xl)] border border-border/70 bg-card/90 px-1 py-1.5 shadow-[0_18px_44px_-10px_rgb(0_0_0/0.72),0_6px_16px_-4px_rgb(0_0_0/0.45),0_0_0_0.5px_rgb(0_0_0/0.35)] backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-card/72">
          <NavTab to={base} end icon={Home} label="Inicio" />
          {allow("crm") && (
            <NavTab to={`${base}/clientes`} icon={Users} label="Clientes" badge={unreadCount > 0} />
          )}
          {/* "Docs", not "Documentos": at seven slots the label box is ~3.4rem
              and the full word truncates to "Documen…", which is uglier than
              the short form and no more informative next to a file glyph. */}
          {reachable.has(docsPath) && <NavTab to={docsPath} icon={FileText} label="Docs" />}
          {canPropo && (
            // `justify-end` and no negative margin on the label. The FAB is
            // lifted out of the bar, so the column below it is taller than a
            // tab's; the label was being dragged back up by a `-mt-1` guess
            // instead of being centred in the space it actually has, which is
            // why "Propo" never lined up with the labels beside it.
            <div className="flex flex-1 flex-col items-center justify-end py-1">
              <button
                type="button"
                onClick={() => propo.open()}
                aria-label="Abrir Propo"
                className="-mt-7 mb-auto flex size-12 items-center justify-center rounded-full bg-ink text-ink-foreground shadow-[0_8px_20px_-4px_rgb(0_0_0/0.55)] transition active:scale-90"
              >
                <PropoMark className="size-6" />
              </button>
              <span className={cn("font-bold text-foreground", NAV_LABEL)}>Propo</span>
            </div>
          )}
          {allow("productividad") && (
            <NavTab to={`${base}/agenda`} icon={CalendarDays} label="Agenda" />
          )}
          {reachable.has(financePath) && (
            <NavTab to={financePath} icon={Receipt} label="Finanzas" />
          )}
          {/* Everything the sidebar can reach lives behind this tab. Without
              it the phone shell could only open whatever the four tabs and the
              home tiles hardcoded, stranding 13 routes at URL-only. */}
          {/* `NavTab`'s markup, not a hand-written copy of it. The copy had
              already drifted — it kept `gap-0.5` and a `text-[10px]` label
              after both moved into the shared constants — so "Más" sat a
              pixel off from the four tabs beside it. */}
          <NavTab
            as="button"
            icon={LayoutGrid}
            label="Más"
            badge={pendingCount > 0}
            ariaLabel={pendingCount > 0 ? `Más · ${pendingCount} pendientes` : "Más"}
            onClick={() => {
              // Opening the sheet is the signal: whatever is tapped next is one
              // of these, and every one of them is a lazy chunk that would
              // otherwise download only after the tap.
              sheetGroups.forEach((g) => g.items.forEach((i) => prefetchRoute(i.path)));
              prefetchRoute(SETTINGS_PATH);
              setMoreOpen(true);
            }}
          />
        </div>
      </nav>

      <BottomSheet open={moreOpen} onOpenChange={setMoreOpen} srOnlyTitle="Menú">
        {/* Identity on the left, the two controls that are not destinations on
            the right. Theme and Configuración used to sit in the destination
            list further down, where a colour toggle read as a place to go. */}
        <div className="mt-1 flex items-center gap-3 pb-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-[15px] font-semibold text-foreground">
            {initials(user.fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold tracking-tight text-foreground">
              {shortName(user.fullName, "Mi cuenta")}
            </div>
            <div className="truncate text-[13px] capitalize text-muted-foreground">
              {user.role.toLowerCase()}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isAdminView && (
              <button
                type="button"
                onClick={() => go(SETTINGS_PATH)}
                aria-label="Configuración"
                className="flex size-11 items-center justify-center rounded-full text-foreground transition active:scale-90 active:bg-secondary"
              >
                <Settings className="size-[20px]" strokeWidth={1.9} />
              </button>
            )}
            <button
              type="button"
              onClick={toggle}
              aria-label={theme === "dark" ? "Cambiar a claro" : "Cambiar a oscuro"}
              className="flex size-11 items-center justify-center rounded-full text-foreground transition active:scale-90 active:bg-secondary"
            >
              {theme === "dark" ? (
                <Moon className="size-[20px]" strokeWidth={1.9} />
              ) : (
                <Sun className="size-[20px]" strokeWidth={1.9} />
              )}
            </button>
          </div>
        </div>

        {/* The destination tree, straight from the shared nav config — the same
            groups the desktop sidebar renders. The grid is auto-fill so a wide
            phone or a tablet uses the room instead of leaving a dead column. */}
        {sheetGroups.map((group, idx) => (
          <div key={group.label ?? `g-${idx}`} className="border-t border-border py-2">
            {group.label && (
              <div className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </div>
            )}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const badge =
                  item.badge === "pending" && pendingCount > 0
                    ? pendingCount
                    : item.badge === "unread" && unreadCount > 0
                      ? unreadCount
                      : null;
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => go(item.path)}
                    className="flex min-h-11 items-center gap-2.5 rounded-xl px-2 py-2.5 text-left transition active:scale-[0.98] active:bg-secondary"
                  >
                    <Icon
                      className="size-[18px] shrink-0 text-muted-foreground"
                      strokeWidth={1.9}
                    />
                    <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-foreground">
                      {item.label}
                    </span>
                    {badge !== null && <Pill tone="accent">{badge}</Pill>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {memberships.length > 1 && (
          <div className="border-t border-border py-2">
            <div className="px-1 pt-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Espacio de trabajo
            </div>
            {memberships.map((m) => {
              const active = m.tenantId === user.tenantId;
              return (
                <button
                  key={m.tenantId}
                  type="button"
                  onClick={() => {
                    if (!active) void switchTenant(m.tenantId);
                    setMoreOpen(false);
                  }}
                  className="flex w-full items-center gap-3 py-2.5 text-left"
                >
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ background: tenantSwatch(m.tenantId) }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-foreground">
                    {m.tenantName ?? m.tenantSlug ?? m.tenantId}
                  </span>
                  {active && <Check className="size-4 text-primary" />}
                </button>
              );
            })}
          </div>
        )}

        {/* The build this phone is actually running. An installed PWA is
            resumed rather than reloaded, so "I pushed a fix and it is not
            there" is usually a stale service worker and there was no way to
            tell that apart from a bug that was never fixed. */}
        <div className="border-t border-border pt-2">
          <BuildStampRow />
        </div>

        <div className="border-t border-border pt-1">
          <SheetItem
            icon={LogOut}
            label="Cerrar sesión"
            onClick={() => {
              setMoreOpen(false);
              signOut();
            }}
            destructive
          />
        </div>
      </BottomSheet>
    </>
  );
}

function SheetItem({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 py-3 text-left text-[15px] font-medium",
        destructive ? "text-destructive" : "text-foreground",
      )}
    >
      <Icon className="size-[18px]" strokeWidth={1.9} />
      {label}
    </button>
  );
}

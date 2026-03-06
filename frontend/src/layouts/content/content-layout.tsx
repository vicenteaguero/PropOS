import { Outlet, NavLink } from "react-router-dom";
import { BottomNav } from "@shared/components/bottom-nav/bottom-nav";
import { CONTENT_NAV_ITEMS } from "@layouts/content/content-nav-items";
import { useAuth } from "@shared/hooks/use-auth";

export function ContentLayout() {
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-screen bg-negro-carbon text-blanco-nieve">
      <aside className="hidden w-60 flex-shrink-0 border-r border-gris-acero/20 bg-negro-carbon md:block">
        <div className="flex h-14 items-center border-b border-gris-acero/20 px-4">
          <span className="text-lg font-bold text-rosa-antiguo">PropOS</span>
        </div>
        <nav className="flex flex-col gap-1 p-2">
          {CONTENT_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150 ${
                  isActive
                    ? "bg-rosa-antiguo/10 text-rosa-antiguo"
                    : "text-gris-acero hover:bg-blanco-nieve/5 hover:text-blanco-nieve"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-gris-acero/20 p-2">
          <button
            type="button"
            onClick={signOut}
            className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-gris-acero transition-colors duration-150 hover:bg-blanco-nieve/5 hover:text-blanco-nieve"
          >
            Cerrar Sesi&oacute;n
          </button>
        </div>
      </aside>

      <main className="flex-1 pb-16 md:pb-0">
        <Outlet />
      </main>

      <BottomNav items={CONTENT_NAV_ITEMS} />
    </div>
  );
}

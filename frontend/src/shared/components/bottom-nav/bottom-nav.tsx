import { NavLink } from "react-router-dom";
import type { NavItem } from "@shared/types/api";

interface BottomNavProps {
  items: NavItem[];
}

const ICON_MAP: Record<string, string> = {
  building: "M3 21V3h18v18H3z",
  users: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm14 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  folder: "M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  message: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  file: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6",
  eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 100 6 3 3 0 000-6z",
  edit: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
};

function NavIcon({ icon }: { icon: string }) {
  const pathData = ICON_MAP[icon] ?? ICON_MAP["file"];
  const paths = pathData?.split(" M") ?? [];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths.map((d, i) => (
        <path key={d} d={i === 0 ? d : `M${d}`} />
      ))}
    </svg>
  );
}

export function BottomNav({ items }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-gris-acero/20 bg-negro-carbon md:hidden">
      <ul className="flex items-center justify-around">
        {items.map((item) => (
          <li key={item.path} className="flex-1">
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                `flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 py-2 text-xs transition-colors duration-150 ${
                  isActive ? "text-rosa-antiguo" : "text-gris-acero"
                }`
              }
            >
              <NavIcon icon={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

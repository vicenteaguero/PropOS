import { Moon, Sun } from "lucide-react";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { useThemeMode } from "@core/theme/theme-provider";

/** Light/dark toggle styled as a sidebar footer item. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useThemeMode();
  const isDark = theme === "dark";
  return (
    <SidebarMenuButton
      tooltip={isDark ? "Cambiar a claro" : "Cambiar a oscuro"}
      onClick={toggle}
      className={className}
    >
      {isDark ? <Moon /> : <Sun />}
      <span className="flex-1 truncate text-left">{isDark ? "Oscuro" : "Claro"}</span>
    </SidebarMenuButton>
  );
}

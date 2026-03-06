import type { ReactNode } from "react";

interface TopBarProps {
  title: string;
  actions?: ReactNode;
}

export function TopBar({ title, actions }: TopBarProps) {
  return (
    <header className="sticky top-0 z-10 flex min-h-14 items-center justify-between border-b border-gris-acero/20 bg-negro-carbon px-4 py-3">
      <h1 className="text-lg font-semibold text-blanco-nieve">{title}</h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

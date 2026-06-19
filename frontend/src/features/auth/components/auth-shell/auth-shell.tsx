import type { ReactNode } from "react";

interface AuthShellProps {
  /** Short line under the wordmark (Spanish). */
  subtitle: string;
  children: ReactNode;
}

/**
 * Mobile-first auth scaffold: centered column, bold "PropOS" wordmark, no card.
 * Constrains to max-w-sm so it never overflows a 390px screen.
 */
export function AuthShell({ subtitle, children }: AuthShellProps) {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">PropOS</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

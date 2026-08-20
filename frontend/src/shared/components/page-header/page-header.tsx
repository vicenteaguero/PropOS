import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Heading scale.
 *
 * Deliberately small. A page's identity is already carried by the nav; a 26px
 * title plus an explanatory subtitle turned every screen into a tutorial and
 * pushed the actual content below the fold. There is no `description` slot on
 * purpose — if a screen needs prose to be understood, fix the screen.
 */
const SIZES = {
  page: "text-[17px]",
  detail: "text-[17px]",
} as const;

interface PageHeaderProps {
  /** Optional: inside a tabbed section the tab already names the view. */
  title?: string;
  actions?: React.ReactNode;
  backTo?: string;
  size?: keyof typeof SIZES;
  className?: string;
}

export function PageHeader({ title, actions, backTo, size = "page", className }: PageHeaderProps) {
  return (
    <div className={cn("mb-4 space-y-1", className)}>
      {backTo && (
        <Button variant="ghost" size="sm" asChild className="-ml-2 min-h-11 px-2">
          <Link to={backTo}>
            <ArrowLeft className="size-4" />
            Volver
          </Link>
        </Button>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1
          className={cn("font-semibold leading-tight tracking-tight text-foreground", SIZES[size])}
        >
          {title}
        </h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

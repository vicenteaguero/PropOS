import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  backTo?: string;
  className?: string;
}

export function PageHeader({ title, description, actions, backTo, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-6 space-y-2", className)}>
      {backTo && (
        <Button variant="ghost" size="sm" asChild className="-ml-2 h-8 px-2">
          <Link to={backTo}>
            <ArrowLeft className="size-4" />
            Volver
          </Link>
        </Button>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

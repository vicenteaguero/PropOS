import { Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useViewAs } from "@core/view-as/view-as";

export function ViewAsBanner() {
  const { target, exit } = useViewAs();
  if (!target) return null;
  return (
    <div className="flex items-center gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
      <Eye className="size-3.5" />
      <span>
        Viendo como <strong>{target.fullName}</strong> ({target.role.toLowerCase()}).
      </span>
      <Button
        size="sm"
        variant="ghost"
        onClick={exit}
        className="ml-auto h-6 gap-1 text-xs text-amber-100 hover:bg-amber-500/15"
      >
        <X className="size-3" />
        Salir
      </Button>
    </div>
  );
}

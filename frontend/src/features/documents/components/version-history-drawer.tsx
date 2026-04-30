import { Check, Clock } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMakeVersionCurrent } from "../hooks/use-documents";
import type { DocumentVersion } from "../types";

interface Props {
  documentId: string;
  currentVersionId: string | null;
  versions: DocumentVersion[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VersionHistoryDrawer({
  documentId,
  currentVersionId,
  versions,
  open,
  onOpenChange,
}: Props) {
  const makeCurrent = useMakeVersionCurrent(documentId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Clock className="size-4" /> Historial de versiones
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="mt-4 h-[calc(100dvh-100px)] pr-3">
          <ul className="space-y-2">
            {versions.map((v) => {
              const isCurrent = v.id === currentVersionId;
              return (
                <li
                  key={v.id}
                  className="rounded-md border border-border bg-card p-3 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">v{v.version_number}</div>
                    {isCurrent && (
                      <span className="flex items-center gap-1 text-xs text-emerald-400">
                        <Check className="size-3" /> Actual
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {new Date(v.created_at).toLocaleString()}
                  </div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">
                    sha {v.sha256.slice(0, 16)}
                  </div>
                  {v.notes && (
                    <p className="mt-1 text-xs">{v.notes}</p>
                  )}
                  {!isCurrent && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-2"
                      onClick={async () => {
                        try {
                          await makeCurrent.mutateAsync(v.id);
                          toast.success(`Versión ${v.version_number} es ahora la actual`);
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Error");
                        }
                      }}
                    >
                      Hacer actual
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

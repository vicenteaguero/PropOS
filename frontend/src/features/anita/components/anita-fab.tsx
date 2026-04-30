import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { AnitaDrawer } from "./anita-drawer";
import { usePendingCount } from "@features/pending/hooks/use-pending";

export function AnitaFAB() {
  const [open, setOpen] = useState(false);
  const pendingCount = usePendingCount();

  return (
    <>
      <Button
        size="lg"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg p-0"
        aria-label="Abrir Anita"
      >
        <Sparkles className="size-6" />
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-5 min-w-5 px-1 text-xs flex items-center justify-center">
            {pendingCount}
          </span>
        )}
      </Button>
      <AnitaDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}

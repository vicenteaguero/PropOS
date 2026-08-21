import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useUfToday } from "../hooks/use-uf";
import { UfDialog } from "./uf-dialog";
import { TOUCH_TARGET_ROW_COARSE } from "@shared/ui";

const CLP_COMPACT = new Intl.NumberFormat("es-CL", {
  notation: "compact",
  maximumFractionDigits: 1,
});

interface Props {
  variant?: "chip" | "icon";
}

export function UfButton({ variant = "chip" }: Props) {
  const [open, setOpen] = useState(false);
  const today = useUfToday();
  const value = today.data?.today?.value_clp ?? null;

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className={`h-7 gap-1.5 rounded-full px-2.5 text-[11px] font-medium ${TOUCH_TARGET_ROW_COARSE}`}
        title="Calculadora UF"
      >
        {/* The accent means "this workspace", not "this unit" — a tenant-coloured
            UF read as brand chrome rather than as a rate. */}
        <span className="font-mono font-semibold tracking-[0.08em] text-foreground">UF</span>
        {variant === "chip" && value != null && (
          <span className="text-muted-foreground">${CLP_COMPACT.format(value)}</span>
        )}
      </Button>
      <UfDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

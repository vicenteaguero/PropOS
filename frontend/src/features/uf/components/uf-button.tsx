import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useUfToday } from "../hooks/use-uf";
import { UfDialog } from "./uf-dialog";

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
  const value = today.data?.today.value_clp ?? null;

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-7 gap-1.5 rounded-full px-2.5 text-[11px] font-medium"
        title="Calculadora UF"
      >
        <span className="text-primary">UF</span>
        {variant === "chip" && value != null && (
          <span className="text-muted-foreground">${CLP_COMPACT.format(value)}</span>
        )}
      </Button>
      <UfDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

import { useMemo, useState } from "react";
import { ArrowDownUp, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUfToday } from "../hooks/use-uf";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const UF_FMT = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

const PCT_FMT = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function DeltaBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-xs text-muted-foreground">—</span>;
  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${
        positive ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
      }`}
    >
      <Icon className="size-3" />
      {positive ? "+" : ""}
      {PCT_FMT.format(value)}%
    </span>
  );
}

export function UfDialog({ open, onOpenChange }: Props) {
  const today = useUfToday();
  const [direction, setDirection] = useState<"uf-to-clp" | "clp-to-uf">("uf-to-clp");
  const [amount, setAmount] = useState("1");

  const value = today.data?.today.value_clp ?? null;
  const dateStr = today.data?.today.date ?? null;

  const converted = useMemo(() => {
    if (value == null) return null;
    const n = parseFloat(amount.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(n)) return null;
    if (direction === "uf-to-clp") return n * value;
    return n / value;
  }, [amount, direction, value]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>UF de hoy</DialogTitle>
        </DialogHeader>

        {today.isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : today.isError || !today.data ? (
          <p className="text-sm text-destructive">No pude cargar la UF.</p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">
                {dateStr
                  ? new Date(dateStr).toLocaleDateString("es-CL", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })
                  : "—"}
              </p>
              <p className="mt-1 text-3xl font-semibold tracking-tight">
                {value != null ? CLP.format(value) : "—"}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Mensual</span>
                  <DeltaBadge value={today.data.month_delta_pct} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Anual</span>
                  <DeltaBadge value={today.data.year_delta_pct} />
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {direction === "uf-to-clp" ? "UF → CLP" : "CLP → UF"}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-xs"
                  onClick={() =>
                    setDirection((d) => (d === "uf-to-clp" ? "clp-to-uf" : "uf-to-clp"))
                  }
                >
                  <ArrowDownUp className="size-3" />
                  Invertir
                </Button>
              </div>
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder={direction === "uf-to-clp" ? "1" : "1000000"}
              />
              <p className="text-right text-lg font-semibold">
                {converted == null
                  ? "—"
                  : direction === "uf-to-clp"
                    ? CLP.format(converted)
                    : `UF ${UF_FMT.format(converted)}`}
              </p>
            </div>

            <p className="text-center text-[10px] text-muted-foreground">
              Fuente: mindicador.cl · Actualización diaria
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

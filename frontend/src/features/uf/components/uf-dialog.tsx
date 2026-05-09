import { useMemo, useState } from "react";
import { Delete, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useUfToday, useUsdToday } from "../hooks/use-uf";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Currency = "UF" | "CLP" | "USD";

const CURRENCIES: Currency[] = ["UF", "CLP", "USD"];

const CLP_FMT = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const USD_FMT = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const UF_FMT = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});
const PCT_FMT = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const INT_FMT = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });

function formatCurrency(value: number | null, c: Currency): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (c === "CLP") return `$${CLP_FMT.format(Math.round(value))} CLP`;
  if (c === "USD") return `US$${USD_FMT.format(value)}`;
  return `${UF_FMT.format(value)} UF`;
}

function DeltaBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-xs text-muted-foreground">—</span>;
  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
        positive ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300",
      )}
    >
      <Icon className="size-3" />
      {positive ? "+" : ""}
      {PCT_FMT.format(value)}%
    </span>
  );
}

function parseAmount(raw: string): number | null {
  if (!raw) return null;
  const n = parseFloat(raw.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function formatAmount(raw: string): string {
  if (!raw) return "0";
  const [intPart, decPart] = raw.split(",");
  const intNum = parseInt(intPart || "0", 10);
  const intStr = Number.isFinite(intNum) ? INT_FMT.format(intNum) : "0";
  return decPart !== undefined ? `${intStr},${decPart}` : intStr;
}

interface KeyProps {
  label: React.ReactNode;
  onClick: () => void;
  variant?: "num" | "accent" | "ghost" | "danger";
  className?: string;
}

function Key({ label, onClick, variant = "num", className }: KeyProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-14 select-none rounded-2xl text-xl font-medium transition active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        variant === "num" && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        variant === "accent" && "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "ghost" && "bg-muted text-muted-foreground hover:bg-muted/70 text-base",
        variant === "danger" &&
          "bg-destructive/15 text-destructive hover:bg-destructive/25 text-base",
        className,
      )}
    >
      {label}
    </button>
  );
}

export function UfDialog({ open, onOpenChange }: Props) {
  const uf = useUfToday();
  const usd = useUsdToday();
  const [from, setFrom] = useState<Currency>("UF");
  const [raw, setRaw] = useState("1");

  const ufValue = uf.data?.today.value_clp ?? null;
  const usdValue = usd.data?.value_clp ?? null;
  const dateStr = uf.data?.today.date ?? null;

  const amountNum = useMemo(() => parseAmount(raw), [raw]);
  const display = useMemo(() => formatAmount(raw), [raw]);

  // Convert source amount to CLP first, then to each target.
  const amountInClp = useMemo(() => {
    if (amountNum == null) return null;
    if (from === "CLP") return amountNum;
    if (from === "UF") return ufValue != null ? amountNum * ufValue : null;
    return usdValue != null ? amountNum * usdValue : null;
  }, [amountNum, from, ufValue, usdValue]);

  const convertTo = (target: Currency): number | null => {
    if (amountInClp == null) return null;
    if (target === "CLP") return amountInClp;
    if (target === "UF") return ufValue ? amountInClp / ufValue : null;
    return usdValue ? amountInClp / usdValue : null;
  };

  const targets = CURRENCIES.filter((c) => c !== from);

  const pushDigit = (d: string) => {
    setRaw((cur) => {
      if (cur === "0") return d;
      const next = cur + d;
      const intPart = next.split(",")[0] ?? "";
      if (intPart.length > 12) return cur;
      return next;
    });
  };

  const pushTriple = () => {
    setRaw((cur) => {
      if (cur === "" || cur === "0") return "0";
      if (cur.includes(",")) return cur;
      const next = cur + "000";
      const intPart = next.split(",")[0] ?? "";
      if (intPart.length > 12) return cur;
      return next;
    });
  };

  const pushDecimal = () => {
    setRaw((cur) => {
      if (cur.includes(",")) return cur;
      return (cur || "0") + ",";
    });
  };

  const backspace = () => {
    setRaw((cur) => {
      if (cur.length <= 1) return "0";
      return cur.slice(0, -1);
    });
  };

  const clear = () => setRaw("0");

  const loading = uf.isLoading || usd.isLoading;
  const hasError = uf.isError && usd.isError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle>Conversor de moneda</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : hasError ? (
          <p className="px-5 py-6 text-sm text-destructive">No pude cargar los valores.</p>
        ) : (
          <div className="space-y-3 px-4 pb-4">
            <div className="rounded-2xl border border-border bg-background/40 p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-xs text-muted-foreground">
                  {dateStr
                    ? new Date(dateStr).toLocaleDateString("es-CL", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })
                    : "—"}
                </p>
                <DeltaBadge value={uf.data?.month_delta_pct ?? null} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between rounded-md bg-muted/40 px-2 py-1">
                  <span className="font-medium text-primary">UF</span>
                  <span className="text-muted-foreground">
                    {ufValue != null ? `$${CLP_FMT.format(Math.round(ufValue))}` : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-md bg-muted/40 px-2 py-1">
                  <span className="font-medium text-primary">USD</span>
                  <span className="text-muted-foreground">
                    {usdValue != null ? `$${CLP_FMT.format(Math.round(usdValue))}` : "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-1 rounded-full bg-muted p-1">
              {CURRENCIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFrom(c)}
                  className={cn(
                    "flex-1 rounded-full py-1.5 text-xs font-semibold transition",
                    from === c
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-background/40 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Monto
                </span>
                <div className="flex items-baseline gap-1.5 truncate">
                  <span className="truncate text-4xl font-light tracking-tight" title={display}>
                    {display}
                  </span>
                  <span className="text-lg font-medium text-primary">{from}</span>
                </div>
              </div>
              <div className="mt-3 space-y-1 border-t border-border/60 pt-3">
                {targets.map((t) => (
                  <div key={t} className="flex items-baseline justify-between text-sm">
                    <span className="text-xs font-medium text-muted-foreground">{t}</span>
                    <span className="font-semibold">{formatCurrency(convertTo(t), t)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Key label="AC" variant="ghost" onClick={clear} />
              <Key label="000" variant="ghost" onClick={pushTriple} />
              <Key
                label={<Delete className="mx-auto size-5" />}
                variant="danger"
                onClick={backspace}
              />

              <Key label="7" onClick={() => pushDigit("7")} />
              <Key label="8" onClick={() => pushDigit("8")} />
              <Key label="9" onClick={() => pushDigit("9")} />

              <Key label="4" onClick={() => pushDigit("4")} />
              <Key label="5" onClick={() => pushDigit("5")} />
              <Key label="6" onClick={() => pushDigit("6")} />

              <Key label="1" onClick={() => pushDigit("1")} />
              <Key label="2" onClick={() => pushDigit("2")} />
              <Key label="3" onClick={() => pushDigit("3")} />

              <Key label="," variant="accent" onClick={pushDecimal} />
              <Key label="0" onClick={() => pushDigit("0")} />
              <Key label="00" variant="ghost" onClick={() => pushDigit("00")} />
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

import { useMemo, useState } from "react";
import { Delete, Loader2, Minus, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsDesktop } from "@/hooks/use-mobile";
import { useUfToday, useUsdToday } from "../hooks/use-uf";
import { ResponsiveSheet, TOUCH_TARGET_HIT_AREA } from "@shared/ui";

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

/**
 * Keeps typed text in the same shape the keypad produces: digits, at most one
 * decimal comma, 12 integer digits. Anything else the physical keyboard can
 * emit (letters, the thousand separators we paint back) is dropped.
 */
function sanitizeTyped(value: string): string {
  const cleaned = value.replace(/[^\d,]/g, "");
  const [intPart = "", ...rest] = cleaned.split(",");
  const int = intPart.replace(/^0+(?=\d)/, "").slice(0, 12);
  if (rest.length === 0) return int || "0";
  return `${int || "0"},${rest.join("").slice(0, 4)}`;
}

/** Month-over-month UF move, inline next to the rate rather than in a badge. */
function Delta({ value }: { value: number | null }) {
  if (value == null) return null;
  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-medium",
        positive ? "text-success" : "text-destructive",
      )}
      title="Variación de la UF este mes"
    >
      <Icon className="size-3" />
      {PCT_FMT.format(value)}%
    </span>
  );
}

/** Today's reference rates, one line — the calculator is the actual content. */
function RatesLine({
  ufValue,
  usdValue,
  deltaPct,
}: {
  ufValue: number | null;
  usdValue: number | null;
  deltaPct: number | null;
}) {
  return (
    <p className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
      <span className="font-semibold text-primary">UF</span>
      <span className="text-foreground">
        {ufValue != null ? `$${CLP_FMT.format(Math.round(ufValue))}` : "—"}
      </span>
      <Delta value={deltaPct} />
      <span className="text-faint">·</span>
      <span className="font-semibold text-primary">USD</span>
      <span className="text-foreground">
        {usdValue != null ? `$${CLP_FMT.format(Math.round(usdValue))}` : "—"}
      </span>
    </p>
  );
}

/**
 * Source-currency picker. Painted small to sit on the amount row, but each
 * segment is a full 44px wide so the hit areas tile instead of overlapping —
 * the caveat `TOUCH_TARGET_HIT_AREA` warns about with adjacent controls.
 */
function CurrencyToggle({ value, onChange }: { value: Currency; onChange: (c: Currency) => void }) {
  return (
    <div className="flex shrink-0 gap-0.5 rounded-full bg-muted p-0.5">
      {CURRENCIES.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn(
            "min-w-11 rounded-full py-1.5 text-xs font-semibold transition",
            TOUCH_TARGET_HIT_AREA,
            value === c
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

/** 1–10% in 0.25% steps — the band Chilean brokerage commissions live in. */
function PctStepper({ pct, onChange }: { pct: number; onChange: (v: number) => void }) {
  const clamp = (v: number) => Math.min(10, Math.max(1, Math.round(v * 4) / 4));
  const btn = `flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition active:scale-90 disabled:opacity-40 ${TOUCH_TARGET_HIT_AREA}`;
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        aria-label="Bajar comisión"
        onClick={() => onChange(clamp(pct - 0.25))}
        disabled={pct <= 1}
        className={btn}
      >
        <Minus className="size-3" />
      </button>
      <span className="w-14 text-center text-sm font-semibold tabular-nums text-primary">
        {PCT_FMT.format(pct)}%
      </span>
      <button
        type="button"
        aria-label="Subir comisión"
        onClick={() => onChange(clamp(pct + 0.25))}
        disabled={pct >= 10}
        className={btn}
      >
        <Plus className="size-3" />
      </button>
    </div>
  );
}

interface KeyProps {
  label: React.ReactNode;
  onClick: () => void;
  variant?: "num" | "accent" | "ghost" | "danger";
}

function Key({ label, onClick, variant = "num" }: KeyProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-11 select-none rounded-lg text-lg font-medium transition active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        variant === "num" && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        variant === "accent" && "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "ghost" && "bg-muted text-sm text-muted-foreground hover:bg-muted/70",
        variant === "danger" && "bg-destructive/15 text-destructive hover:bg-destructive/25",
      )}
    >
      {label}
    </button>
  );
}

export function UfDialog({ open, onOpenChange }: Props) {
  const isDesktop = useIsDesktop();
  const uf = useUfToday();
  const usd = useUsdToday();
  const [from, setFrom] = useState<Currency>("UF");
  // Calculator always starts at 0; the first digit press overwrites it.
  const [raw, setRaw] = useState("0");
  // Broker commission, default 4%.
  const [pct, setPct] = useState(4);

  const ufValue = uf.data?.today?.value_clp ?? null;
  const usdValue = usd.data?.value_clp ?? null;

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

  // Commission = pct of the entered amount (shown in the source currency + CLP).
  const commissionFrom = amountNum != null ? (amountNum * pct) / 100 : null;
  const commissionClp = amountInClp != null ? (amountInClp * pct) / 100 : null;

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

  const ratesLine = (
    <RatesLine ufValue={ufValue} usdValue={usdValue} deltaPct={uf.data?.month_delta_pct ?? null} />
  );

  const conversions = (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm tabular-nums text-muted-foreground">
      {targets.map((t, i) => (
        <span key={t}>
          {i > 0 && <span className="mr-2 text-faint">·</span>}
          <span className="font-semibold text-foreground">{formatCurrency(convertTo(t), t)}</span>
        </span>
      ))}
    </p>
  );

  const keypad = (
    <div className="grid grid-cols-3 gap-1.5">
      <Key label="AC" variant="ghost" onClick={clear} />
      <Key label="000" variant="ghost" onClick={pushTriple} />
      <Key label={<Delete className="mx-auto size-4" />} variant="danger" onClick={backspace} />

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
  );

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      srOnlyTitle="Conversor de moneda"
      desktopClassName="max-w-lg"
    >
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : hasError ? (
        <p className="py-6 text-sm text-destructive">No pude cargar los valores.</p>
      ) : isDesktop ? (
        // Desktop drives the amount from the physical keyboard, so the keypad is
        // dead weight; the freed width becomes a second column.
        <div className="space-y-4">
          {ratesLine}
          <div className="grid grid-cols-[1fr_auto] gap-6">
            <div className="min-w-0 space-y-2">
              <CurrencyToggle value={from} onChange={setFrom} />
              <div className="flex items-baseline gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label="Monto"
                  value={display}
                  onChange={(e) => setRaw(sanitizeTyped(e.target.value))}
                  className="w-full min-w-0 bg-transparent text-3xl font-semibold tabular-nums tracking-tight outline-none"
                />
                <span className="text-base font-medium text-primary">{from}</span>
              </div>
              {conversions}
            </div>
            <div className="w-52 shrink-0 space-y-2 border-l border-border pl-6">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Comisión
              </span>
              <PctStepper pct={pct} onChange={setPct} />
              <p className="text-lg font-semibold tabular-nums">
                {formatCurrency(commissionFrom, from)}
              </p>
              {from !== "CLP" && (
                <p className="text-xs tabular-nums text-faint">
                  {formatCurrency(commissionClp, "CLP")}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2 pb-1">
          {ratesLine}
          <div className="flex items-center justify-between gap-3">
            <CurrencyToggle value={from} onChange={setFrom} />
            <span className="flex min-w-0 items-baseline gap-1.5">
              <span
                className="truncate text-3xl font-semibold tabular-nums tracking-tight"
                title={display}
              >
                {display}
              </span>
              <span className="text-base font-medium text-primary">{from}</span>
            </span>
          </div>
          {conversions}
          <div className="flex items-center justify-between gap-2">
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Comisión
              </span>
              <PctStepper pct={pct} onChange={setPct} />
            </span>
            <span className="flex min-w-0 items-baseline gap-1.5 truncate text-sm tabular-nums">
              <span className="font-semibold">{formatCurrency(commissionFrom, from)}</span>
              {from !== "CLP" && (
                <span className="text-xs text-faint">{formatCurrency(commissionClp, "CLP")}</span>
              )}
            </span>
          </div>
          {keypad}
        </div>
      )}
    </ResponsiveSheet>
  );
}

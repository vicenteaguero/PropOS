import { useMemo, useState } from "react";
import { ArrowDown, Delete, Loader2, Minus, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsDesktop } from "@/hooks/use-mobile";
import { useUfForward, useUfToday, useUsdToday } from "../hooks/use-uf";
import type { UfPoint } from "../api/uf-api";
import { ResponsiveSheet, TOUCH_TARGET_HIT_AREA } from "@shared/ui";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Currency = "UF" | "CLP" | "USD";

const CURRENCIES: Currency[] = ["UF", "CLP", "USD"];

/**
 * One hue per currency, so a number's unit is readable before reading its
 * suffix. The tenant accent (`--primary`) is deliberately not used here: it is
 * a single hue and would paint all three the same, which is what made the
 * previous version unreadable. Pairs are light/dark because the app ships both.
 */
const CURRENCY_STYLE: Record<Currency, { text: string; solid: string }> = {
  UF: {
    text: "text-violet-600 dark:text-violet-400",
    solid: "bg-violet-600 text-white dark:bg-violet-500 dark:text-white",
  },
  CLP: {
    text: "text-sky-600 dark:text-sky-400",
    solid: "bg-sky-600 text-white dark:bg-sky-500 dark:text-white",
  },
  USD: {
    text: "text-emerald-600 dark:text-emerald-400",
    solid: "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white",
  },
};

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
const DAY_FMT = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" });

/** Number and unit come back apart so each can be painted at its own weight. */
function formatParts(value: number | null, c: Currency): { value: string; unit: string } {
  if (value == null || !Number.isFinite(value)) return { value: "—", unit: "" };
  if (c === "CLP") return { value: `$${CLP_FMT.format(Math.round(value))}`, unit: "CLP" };
  if (c === "USD") return { value: `US$${USD_FMT.format(value)}`, unit: "USD" };
  return { value: UF_FMT.format(value), unit: "UF" };
}

function formatCurrency(value: number | null, c: Currency): string {
  const { value: v, unit } = formatParts(value, c);
  return unit ? `${v} ${unit}` : v;
}

/** `2026-08-20` → `20 ago`, without letting a timezone shift the day. */
function formatDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return DAY_FMT.format(new Date(y, m - 1, d)).replace(".", "");
}

/**
 * Last officially published UF of the current month. The Banco Central fixes the
 * 10th→9th window ahead of time, so this is a figure a broker can quote, not a
 * projection — worth surfacing next to today's value.
 */
function monthClose(points: UfPoint[] | undefined, todayIso: string | undefined): UfPoint | null {
  if (!points?.length) return null;
  const month = (todayIso ?? new Date().toISOString().slice(0, 10)).slice(0, 7);
  const inMonth = points.filter((p) => p.date.slice(0, 7) === month);
  const pool = inMonth.length ? inMonth : points;
  return pool.reduce<UfPoint | null>((best, p) => (best && best.date > p.date ? best : p), null);
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

/**
 * Currency badge. CLP and USD carry their flag; UF has no country, so it gets a
 * violet diamond — a mark of its own rather than borrowing the Chilean flag,
 * which would make the two Chilean units look identical at a glance.
 */
function Mark({ c, className }: { c: Currency; className?: string }) {
  if (c === "UF") {
    return (
      <span
        aria-hidden
        className={cn(
          "inline-block size-2.5 rotate-45 rounded-[2px] bg-violet-600 dark:bg-violet-400",
          className,
        )}
      />
    );
  }
  return (
    <span aria-hidden className={cn("text-[13px] leading-none", className)}>
      {c === "CLP" ? "🇨🇱" : "🇺🇸"}
    </span>
  );
}

/** Signed move, inline. Used for both the month and the year UF deltas. */
function Delta({ value, label }: { value: number | null; label: string }) {
  if (value == null) return null;
  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-medium tabular-nums",
        positive ? "text-success" : "text-destructive",
      )}
    >
      <Icon className="size-2.5" />
      {PCT_FMT.format(value)}%<span className="text-faint">{label}</span>
    </span>
  );
}

/** One reference-rate cell: "1 <unidad>" over its value in pesos. */
function RateCell({
  currency,
  title,
  value,
  children,
}: {
  currency: Currency;
  title: string;
  value: number | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 px-2.5 py-1.5">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
        <Mark c={currency} />
        <span className={CURRENCY_STYLE[currency].text}>{title}</span>
      </div>
      <div className="truncate text-[15px] font-semibold tabular-nums leading-tight">
        {value != null ? `$${CLP_FMT.format(Math.round(value))}` : "—"}
      </div>
      {children}
    </div>
  );
}

/**
 * Reference rates + provenance. Both values are pesos-per-unit, so each cell
 * says which unit it prices instead of leaving two bare `$` figures to be read
 * as the same thing.
 */
function RatesPanel({
  ufValue,
  usdValue,
  monthPct,
  yearPct,
  asOf,
  source,
  close,
}: {
  ufValue: number | null;
  usdValue: number | null;
  monthPct: number | null;
  yearPct: number | null;
  asOf: string | null;
  source: string | null;
  close: UfPoint | null;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="grid grid-cols-2 divide-x divide-border">
        <RateCell currency="UF" title="1 UF" value={ufValue}>
          <div className="flex flex-wrap items-center gap-x-1.5 text-[10px] leading-tight">
            <Delta value={monthPct} label=" mes" />
            <Delta value={yearPct} label=" año" />
          </div>
        </RateCell>
        <RateCell currency="USD" title="1 USD" value={usdValue}>
          {close && (
            <div className="truncate text-[10px] leading-tight text-muted-foreground">
              <span className="text-faint">cierre {formatDay(close.date)}</span>{" "}
              <span className="font-medium tabular-nums text-foreground">
                ${CLP_FMT.format(Math.round(close.value_clp))}
              </span>
            </div>
          )}
        </RateCell>
      </div>
      <div className="border-t border-border bg-muted/40 px-2.5 py-1 text-[10px] text-faint">
        Al {asOf ?? "—"}
        {source ? ` · ${source}` : ""}
      </div>
    </section>
  );
}

/**
 * Source-currency picker. Painted small to sit on the amount row, but each
 * segment is a full 44px wide so the hit areas tile instead of overlapping —
 * the caveat `TOUCH_TARGET_HIT_AREA` warns about with adjacent controls.
 */
function CurrencyToggle({ value, onChange }: { value: Currency; onChange: (c: Currency) => void }) {
  return (
    <div className="flex shrink-0 gap-0.5 rounded-lg bg-muted p-0.5">
      {CURRENCIES.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-pressed={value === c}
          className={cn(
            "flex min-w-11 items-center justify-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold transition",
            TOUCH_TARGET_HIT_AREA,
            value === c
              ? CURRENCY_STYLE[c].solid
              : "text-muted-foreground hover:text-foreground active:scale-95",
          )}
        >
          <Mark
            c={c}
            className={value === c && c === "UF" ? "bg-white dark:bg-white" : undefined}
          />
          {c}
        </button>
      ))}
    </div>
  );
}

/** 1–10% in 0.25% steps — the band Chilean brokerage commissions live in. */
function PctStepper({ pct, onChange }: { pct: number; onChange: (v: number) => void }) {
  const clamp = (v: number) => Math.min(10, Math.max(1, Math.round(v * 4) / 4));
  const btn = `flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground transition active:scale-90 disabled:opacity-40 ${TOUCH_TARGET_HIT_AREA}`;
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        aria-label="Bajar comisión"
        onClick={() => onChange(clamp(pct - 0.25))}
        disabled={pct <= 1}
        className={btn}
      >
        <Minus className="size-3" />
      </button>
      <span className="w-12 text-center text-[13px] font-semibold tabular-nums">
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

/**
 * A converted amount. The primary one is the largest text in the dialog — the
 * answer, not the chrome, is what the broker came for.
 */
function ResultRow({
  currency,
  value,
  primary,
}: {
  currency: Currency;
  value: number | null;
  primary?: boolean;
}) {
  const { value: v, unit } = formatParts(value, currency);
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2">
      <span
        className={cn(
          "flex shrink-0 items-center gap-1 font-semibold uppercase tracking-wide",
          primary ? "text-[11px]" : "text-[10px]",
          CURRENCY_STYLE[currency].text,
        )}
      >
        <Mark c={currency} />
        {unit || currency}
      </span>
      <span
        className={cn(
          "min-w-0 truncate text-right font-bold tabular-nums tracking-tight",
          primary ? "text-[30px] leading-none" : "text-[15px] leading-none",
        )}
        title={v}
      >
        {v}
      </span>
    </div>
  );
}

interface KeyProps {
  label: React.ReactNode;
  onClick: () => void;
  variant?: "num" | "ghost" | "danger";
}

function Key({ label, onClick, variant = "num" }: KeyProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // Chrome sits a step below the numbers it produces: the keypad used to
        // be louder than the result it computed.
        "h-10 select-none rounded-md text-base font-medium transition active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        variant === "num" && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        variant === "ghost" && "bg-muted text-[13px] text-muted-foreground hover:bg-muted/70",
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
  const forward = useUfForward();
  const [from, setFrom] = useState<Currency>("UF");
  // Calculator always starts at 0; the first digit press overwrites it.
  const [raw, setRaw] = useState("0");
  // Broker commission, default 4%.
  const [pct, setPct] = useState(4);

  const ufValue = uf.data?.today?.value_clp ?? null;
  const usdValue = usd.data?.value_clp ?? null;

  const amountNum = useMemo(() => parseAmount(raw), [raw]);
  const display = useMemo(() => formatAmount(raw), [raw]);
  const close = useMemo(
    () => monthClose(forward.data?.points, uf.data?.today?.date),
    [forward.data?.points, uf.data?.today?.date],
  );

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

  // Pesos are what a Chilean deal closes in, so CLP is the headline result
  // whenever it is not already the input.
  const primaryTarget: Currency = from === "CLP" ? "UF" : "CLP";
  const secondaryTarget = CURRENCIES.filter((c) => c !== from && c !== primaryTarget)[0];

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

  const ratesPanel = (
    <RatesPanel
      ufValue={ufValue}
      usdValue={usdValue}
      monthPct={uf.data?.month_delta_pct ?? null}
      yearPct={uf.data?.year_delta_pct ?? null}
      asOf={formatDay(uf.data?.today?.date)}
      source={uf.data?.today?.source ?? usd.data?.source ?? null}
      close={close}
    />
  );

  /** Source area: which unit is being typed, and the amount itself. */
  const sourceArea = (
    <div className="flex items-center justify-between gap-2">
      <CurrencyToggle value={from} onChange={setFrom} />
      {isDesktop ? (
        <input
          type="text"
          inputMode="decimal"
          aria-label="Monto"
          value={display}
          onChange={(e) => setRaw(sanitizeTyped(e.target.value))}
          className={cn(
            "min-w-0 flex-1 bg-transparent text-right text-2xl font-semibold tabular-nums tracking-tight outline-none",
            CURRENCY_STYLE[from].text,
          )}
        />
      ) : (
        <span
          className={cn(
            "min-w-0 truncate text-right text-2xl font-semibold tabular-nums tracking-tight",
            CURRENCY_STYLE[from].text,
          )}
          title={display}
        >
          {display}
        </span>
      )}
    </div>
  );

  /** Result area: the answer, and the only place with 30px type. */
  const resultArea = (
    <div className="rounded-lg border border-border bg-muted/30 px-2.5 py-2">
      <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <ArrowDown className="size-3" />
        Equivale a
      </div>
      <ResultRow currency={primaryTarget} value={convertTo(primaryTarget)} primary />
      {secondaryTarget && (
        <div className="mt-1.5 border-t border-border pt-1.5">
          <ResultRow currency={secondaryTarget} value={convertTo(secondaryTarget)} />
        </div>
      )}
    </div>
  );

  /**
   * Commission area. The amount wraps onto its own line instead of sitting in a
   * `truncate` span, which silently cut the figure off on a narrow phone.
   */
  const commissionArea = (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5">
      <span className="flex shrink-0 items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Comisión
        </span>
        <PctStepper pct={pct} onChange={setPct} />
      </span>
      <span className="flex min-w-0 flex-col items-end leading-tight">
        <span className={cn("text-[15px] font-bold tabular-nums", CURRENCY_STYLE[from].text)}>
          {formatCurrency(commissionFrom, from)}
        </span>
        {from !== "CLP" && (
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {formatCurrency(commissionClp, "CLP")}
          </span>
        )}
      </span>
    </div>
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

      <Key label="," onClick={pushDecimal} />
      <Key label="0" onClick={() => pushDigit("0")} />
      <Key label="00" variant="ghost" onClick={() => pushDigit("00")} />
    </div>
  );

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Conversor"
      // The mobile sheet has a fixed height budget (375x667 must not scroll), so
      // the default bottom padding is trimmed here and restored on desktop.
      className="pb-[calc(var(--safe-bottom)+1rem)]"
      desktopClassName="max-w-lg pb-6"
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
        <div className="mt-3 space-y-2.5">
          {ratesPanel}
          <div className="grid grid-cols-[1fr_13rem] gap-4">
            <div className="min-w-0 space-y-2">
              {sourceArea}
              {resultArea}
            </div>
            <div className="min-w-0">{commissionArea}</div>
          </div>
        </div>
      ) : (
        <div className="mt-2 space-y-1.5 pb-1">
          {ratesPanel}
          {sourceArea}
          {resultArea}
          {commissionArea}
          {keypad}
        </div>
      )}
    </ResponsiveSheet>
  );
}

import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Loader2,
  Megaphone,
  Plus,
  Receipt,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLayout } from "@shared/components/page-layout";
import { Chip, Chips, Pill, ResponsiveSheet, Row, type PillTone } from "@shared/ui";
import { useIsDesktop } from "@/hooks/use-mobile";
import { toast } from "sonner";
import {
  useCompleteTransaction,
  useCreateTransaction,
  useFinanceSummary,
  useTransactions,
} from "../hooks/use-finance";
import { TX_CATEGORIES, type Transaction, type TxDirection } from "../api/finance-api";
import { CommissionCalculator } from "../components/commission-calculator";

/** Spanish labels for the transaction category enum (UI Spanish, code English). */
const TX_CATEGORY: Record<string, string> = {
  COMMISSION: "Comisión",
  SALE_PROCEEDS: "Venta",
  RENT: "Arriendo",
  AD_SPEND: "Publicidad",
  MARKETING: "Marketing",
  NOTARY_FEE: "Notaría",
  TAX: "Impuestos",
  UTILITY: "Servicios",
  SALARY: "Sueldos",
  SOFTWARE: "Software",
  REIMBURSEMENT: "Reembolso",
  DEPOSIT: "Depósito",
  REFUND: "Devolución",
  TRANSFER: "Transferencia",
  OTHER: "Otro",
};

function categoryLabel(category: string): string {
  return TX_CATEGORY[category] ?? category;
}

function clp(cents: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

const STATUS_META: Record<string, { label: string; tone: PillTone }> = {
  PENDING: { label: "Pendiente", tone: "warning" },
  COMPLETED: { label: "Completado", tone: "success" },
  CANCELLED: { label: "Anulado", tone: "neutral" },
};

/** Leading icon per transaction (by category/direction). */
function txIcon(t: Transaction): LucideIcon {
  if (t.receipt_document_id) return Receipt;
  if (t.category === "COMMISSION") return Wallet;
  if (t.category === "AD_SPEND" || t.category === "MARKETING") return Megaphone;
  return t.direction === "IN" ? ArrowDownLeft : ArrowUpRight;
}

/** Short stable code from the transaction id (presentational). */
function txCode(id: string): string {
  return id.replace(/-/g, "").slice(0, 6).toUpperCase();
}

type KindFilter = "ALL" | "COMMISSION" | "EXPENSE" | "RECEIPT" | "PAYMENT";

const KIND_FILTERS: { id: KindFilter; label: string }[] = [
  { id: "ALL", label: "Todo" },
  { id: "COMMISSION", label: "Comisiones" },
  { id: "EXPENSE", label: "Gastos" },
  { id: "RECEIPT", label: "Boletas" },
  { id: "PAYMENT", label: "Pagos" },
];

function matchesKind(t: Transaction, kind: KindFilter): boolean {
  switch (kind) {
    case "COMMISSION":
      return t.category === "COMMISSION";
    case "EXPENSE":
      return t.direction === "OUT";
    case "RECEIPT":
      return t.receipt_document_id != null;
    case "PAYMENT":
      return t.status === "PENDING";
    default:
      return true;
  }
}

export function FinancePage() {
  const isDesktop = useIsDesktop();
  const { data: summary } = useFinanceSummary();
  const { data: txs, isLoading, error, refetch } = useTransactions();
  const create = useCreateTransaction();
  const complete = useCompleteTransaction();

  const [kind, setKind] = useState<KindFilter>("ALL");
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<TxDirection>("IN");
  const [category, setCategory] = useState<string>("COMMISSION");
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [dueAt, setDueAt] = useState("");

  const filtered = useMemo(() => (txs ?? []).filter((t) => matchesKind(t, kind)), [txs, kind]);

  const submit = async () => {
    if (!amount) {
      toast.error("Ingresá un monto");
      return;
    }
    await create.mutateAsync({
      direction,
      category,
      amount_cents: Math.round(Number(amount) * 100),
      status: pending ? "PENDING" : "COMPLETED",
      due_at: pending && dueAt ? new Date(dueAt).toISOString() : null,
    });
    setAmount("");
    setDueAt("");
    setOpen(false);
    toast.success("Transacción registrada");
  };

  // Secondary KPIs shared by the mobile ink card and the desktop card row.
  const secondaryKpis = [
    { label: "Por cobrar", value: summary?.receivable_cents ?? 0, tone: "warning" as const },
    { label: "Gastos", value: summary?.expense_cents ?? 0, tone: "destructive" as const },
    { label: "Por pagar", value: summary?.payable_cents ?? 0, tone: "muted" as const },
  ];

  const transactionsBlock = (
    <>
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <div className="mx-5 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive lg:mx-0">
          No se pudieron cargar las transacciones.
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      )}
      {!isLoading && !error && filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">Sin transacciones.</p>
      )}

      {/* Mobile: Row list. Desktop: denser table. */}
      {!isLoading && !error && filtered.length > 0 && !isDesktop && (
        <div>
          {filtered.map((t, i) => {
            const Icon = txIcon(t);
            const status = STATUS_META[t.status] ?? STATUS_META.COMPLETED;
            const occurred = t.occurred_at ?? t.due_at;
            const dateLabel = occurred
              ? new Date(occurred).toLocaleDateString("es-CL", { day: "2-digit", month: "short" })
              : null;
            const overdue = t.status === "PENDING" && t.due_at && new Date(t.due_at) < new Date();
            return (
              <Row
                key={t.id}
                divider={i < filtered.length - 1}
                left={
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
                    <Icon className="size-[18px]" strokeWidth={1.8} />
                  </span>
                }
                title={t.description || categoryLabel(t.category)}
                sub={
                  <span className="flex items-center gap-2">
                    <Pill tone={status?.tone ?? "neutral"}>{status?.label ?? t.status}</Pill>
                    <span className="truncate">
                      {txCode(t.id)}
                      {dateLabel ? ` · ${dateLabel}` : ""}
                    </span>
                    {overdue && <span className="font-medium text-destructive">vencido</span>}
                  </span>
                }
                right={
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span
                      className={`text-[15px] font-bold tabular-nums ${
                        t.direction === "IN" ? "text-success" : "text-destructive"
                      }`}
                    >
                      {t.direction === "IN" ? "+" : "−"}
                      {clp(t.amount_cents)}
                    </span>
                    {t.status === "PENDING" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-success"
                        title="Marcar pagado"
                        onClick={() => complete.mutate(t.id)}
                      >
                        <Check className="size-4" strokeWidth={2} />
                      </Button>
                    )}
                  </div>
                }
              />
            );
          })}
        </div>
      )}

      {!isLoading && !error && filtered.length > 0 && isDesktop && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[12px] font-medium text-muted-foreground">
                <th className="py-2.5 pl-4 pr-3 font-medium">Concepto</th>
                <th className="px-3 py-2.5 font-medium">Categoría</th>
                <th className="px-3 py-2.5 font-medium">Estado</th>
                <th className="px-3 py-2.5 font-medium">Fecha</th>
                <th className="px-3 py-2.5 text-right font-medium">Monto</th>
                <th className="py-2.5 pl-3 pr-4" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => {
                const Icon = txIcon(t);
                const status = STATUS_META[t.status] ?? STATUS_META.COMPLETED;
                const occurred = t.occurred_at ?? t.due_at;
                const dateLabel = occurred
                  ? new Date(occurred).toLocaleDateString("es-CL", {
                      day: "2-digit",
                      month: "short",
                    })
                  : "—";
                const overdue =
                  t.status === "PENDING" && t.due_at && new Date(t.due_at) < new Date();
                return (
                  <tr
                    key={t.id}
                    className={`align-middle ${i < filtered.length - 1 ? "border-b border-border" : ""} transition hover:bg-secondary/40`}
                  >
                    <td className="py-2.5 pl-4 pr-3">
                      <div className="flex items-center gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
                          <Icon className="size-4" strokeWidth={1.8} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-foreground">
                            {t.description || categoryLabel(t.category)}
                          </span>
                          <span className="block font-mono text-[11px] text-muted-foreground">
                            {txCode(t.id)}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {categoryLabel(t.category)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-2">
                        <Pill tone={status?.tone ?? "neutral"}>{status?.label ?? t.status}</Pill>
                        {overdue && (
                          <span className="text-[12px] font-medium text-destructive">vencido</span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{dateLabel}</td>
                    <td
                      className={`px-3 py-2.5 text-right text-[15px] font-bold tabular-nums ${
                        t.direction === "IN" ? "text-success" : "text-destructive"
                      }`}
                    >
                      {t.direction === "IN" ? "+" : "−"}
                      {clp(t.amount_cents)}
                    </td>
                    <td className="py-2.5 pl-3 pr-4 text-right">
                      {t.status === "PENDING" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-success"
                          title="Marcar pagado"
                          onClick={() => complete.mutate(t.id)}
                        >
                          <Check className="size-4" strokeWidth={2} />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  return (
    <PageLayout width="md" noPadding className="pb-6 lg:max-w-none">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 lg:px-8 lg:pt-7">
        <div>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">
            Finanzas
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Comisiones, gastos y pagos por cobrar
          </p>
        </div>
        <Button
          variant="ink"
          size="icon-lg"
          className="rounded-full"
          aria-label="Nueva transacción"
          onClick={() => setOpen(true)}
        >
          <Plus className="size-5" strokeWidth={1.8} />
        </Button>
      </div>

      {/* Mobile: ink summary card (unchanged). Desktop: KPI card row. */}
      <div className="px-5 pb-4 lg:hidden">
        <div className="rounded-2xl bg-foreground p-5 text-background">
          <p className="text-[13px] font-medium text-background/60">Ingresos del mes</p>
          <p className="mt-1 text-[34px] font-bold leading-none tracking-tight">
            {clp(summary?.income_cents ?? 0)}
          </p>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {secondaryKpis.map((s) => (
              <div key={s.label}>
                <p className="text-[11px] font-medium text-background/60">{s.label}</p>
                <p className="mt-0.5 text-[15px] font-semibold tabular-nums">{clp(s.value)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile-only calculator — keeps the original stacking order (above the
          filter). Desktop renders it as a right-side widget below instead. */}
      <div className="px-5 pb-4 lg:hidden">
        <CommissionCalculator />
      </div>

      <div className="hidden px-8 pb-5 lg:grid lg:grid-cols-4 lg:gap-4">
        <div className="rounded-2xl bg-foreground p-5 text-background">
          <p className="text-[13px] font-medium text-background/60">Ingresos del mes</p>
          <p className="mt-1.5 text-[28px] font-bold leading-none tracking-tight tabular-nums">
            {clp(summary?.income_cents ?? 0)}
          </p>
        </div>
        {secondaryKpis.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-[13px] font-medium text-muted-foreground">{s.label}</p>
            <p
              className={`mt-1.5 text-[28px] font-bold leading-none tracking-tight tabular-nums ${
                s.tone === "warning"
                  ? "text-warning"
                  : s.tone === "destructive"
                    ? "text-destructive"
                    : "text-foreground"
              }`}
            >
              {clp(s.value)}
            </p>
          </div>
        ))}
      </div>

      {/* Desktop: calculator becomes a right-side widget alongside transactions.
          Mobile: stacked (calculator, then filter + list) — unchanged. */}
      <div className="lg:grid lg:grid-cols-[1fr_20rem] lg:items-start lg:gap-6 lg:px-8">
        <div className="min-w-0">
          {/* Kind filter */}
          <Chips className="px-5 pb-4 lg:px-0">
            {KIND_FILTERS.map((f) => (
              <Chip key={f.id} active={kind === f.id} onClick={() => setKind(f.id)}>
                {f.label}
              </Chip>
            ))}
          </Chips>
          {transactionsBlock}
        </div>

        <aside className="hidden lg:sticky lg:top-6 lg:block lg:px-0 lg:pt-0">
          <CommissionCalculator />
        </aside>
      </div>

      <ResponsiveSheet open={open} onOpenChange={setOpen} title="Nueva transacción">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as TxDirection)}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="IN">Ingreso</option>
                <option value="OUT">Gasto</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
              >
                {TX_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-amount">Monto (CLP)</Label>
            <Input
              id="f-amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pending}
              onChange={(e) => setPending(e.target.checked)}
            />
            Pendiente (por cobrar / por pagar)
          </label>
          {pending && (
            <div className="space-y-1.5">
              <Label htmlFor="f-due">Vence</Label>
              <Input
                id="f-due"
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={create.isPending}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={create.isPending} className="gap-2">
              {create.isPending && <Loader2 className="size-4 animate-spin" />}
              Registrar
            </Button>
          </div>
        </div>
      </ResponsiveSheet>
    </PageLayout>
  );
}

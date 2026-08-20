import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  Receipt,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLayout } from "@shared/components/page-layout";
import {
  Chip,
  Chips,
  ErrorState,
  FieldGroup,
  PageSkeleton,
  Pill,
  ResponsiveSheet,
  ResponsiveTable,
  type ResponsiveColumn,
} from "@shared/ui";
import { toast } from "sonner";
import {
  useCompleteTransaction,
  useCreateTransaction,
  useFinanceSummary,
  useTransactions,
  useUpdateTransaction,
} from "../hooks/use-finance";
import {
  TX_CATEGORIES,
  type Transaction,
  type TxDirection,
  type TxStatus,
} from "../api/finance-api";
import { CommissionCalculator } from "../components/commission-calculator";
import { ReceiptPicker } from "../components/receipt-picker";
import { formatClp } from "@shared/utils/currency";
import { TX_CATEGORY_LABELS, label } from "@shared/lib/labels";
import { TX_STATUS_TONES, tone } from "@shared/lib/tones";

function categoryLabel(category: string): string {
  return TX_CATEGORY_LABELS[category] ?? category;
}

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

/** Shared shape of the create + edit transaction forms. */
interface TxFormState {
  direction: TxDirection;
  category: string;
  amount: string;
  description: string;
  pending: boolean;
  dueAt: string;
  receiptDocumentId: string | null;
}

const EMPTY_TX_FORM: TxFormState = {
  direction: "IN",
  category: "COMMISSION",
  amount: "",
  description: "",
  pending: false,
  dueAt: "",
  receiptDocumentId: null,
};

/** `date` input value for an ISO string (empty when absent). */
function toDateInput(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "";
}

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
  const { data: summary } = useFinanceSummary();
  const { data: txs, isLoading, error, refetch } = useTransactions();
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const complete = useCompleteTransaction();

  const [kind, setKind] = useState<KindFilter>("ALL");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [form, setForm] = useState<TxFormState>(EMPTY_TX_FORM);

  const filtered = useMemo(() => (txs ?? []).filter((t) => matchesKind(t, kind)), [txs, kind]);

  const openCreate = () => {
    setForm(EMPTY_TX_FORM);
    setOpen(true);
  };

  const openEdit = (t: Transaction) => {
    setForm({
      direction: t.direction,
      category: t.category,
      amount: String(t.amount_cents / 100),
      description: t.description ?? "",
      pending: t.status === "PENDING",
      dueAt: toDateInput(t.due_at),
      receiptDocumentId: t.receipt_document_id,
    });
    setEditing(t);
  };

  const submit = async () => {
    if (!form.amount) {
      toast.error("Ingresa un monto");
      return;
    }
    await create.mutateAsync({
      direction: form.direction,
      category: form.category,
      amount_cents: Math.round(Number(form.amount) * 100),
      status: form.pending ? "PENDING" : "COMPLETED",
      due_at: form.pending && form.dueAt ? new Date(form.dueAt).toISOString() : null,
      description: form.description.trim() || null,
      receipt_document_id: form.receiptDocumentId,
    });
    setForm(EMPTY_TX_FORM);
    setOpen(false);
    toast.success("Transacción registrada");
  };

  const submitEdit = async () => {
    if (!editing) return;
    if (!form.amount) {
      toast.error("Ingresa un monto");
      return;
    }
    // Only the pending/settled pair is toggled here — a cancelled transaction
    // keeps its status.
    const status: TxStatus = form.pending
      ? "PENDING"
      : editing.status === "PENDING"
        ? "COMPLETED"
        : editing.status;
    await update.mutateAsync({
      id: editing.id,
      body: {
        direction: form.direction,
        category: form.category,
        amount_cents: Math.round(Number(form.amount) * 100),
        status,
        due_at: form.pending && form.dueAt ? new Date(form.dueAt).toISOString() : null,
        description: form.description.trim() || null,
        receipt_document_id: form.receiptDocumentId,
      },
    });
    setEditing(null);
    toast.success("Transacción actualizada");
  };

  // Secondary KPIs shared by the mobile ink card and the desktop card row.
  const secondaryKpis = [
    { label: "Por cobrar", value: summary?.receivable_cents ?? 0, tone: "warning" as const },
    { label: "Gastos", value: summary?.expense_cents ?? 0, tone: "destructive" as const },
    { label: "Por pagar", value: summary?.payable_cents ?? 0, tone: "muted" as const },
  ];

  // Cells shared by both presentations. Declaring them once is the whole point
  // of the primitive below: a status pill that only got a `vencido` flag in the
  // table and not in the phone list is exactly the drift this prevents.
  const dateLabel = (t: Transaction) => {
    const occurred = t.occurred_at ?? t.due_at;
    return occurred
      ? new Date(occurred).toLocaleDateString("es-CL", { day: "2-digit", month: "short" })
      : null;
  };
  const isOverdue = (t: Transaction) =>
    t.status === "PENDING" && !!t.due_at && new Date(t.due_at) < new Date();
  const statusCell = (t: Transaction) => (
    <span className="flex items-center gap-2">
      <Pill tone={tone(TX_STATUS_TONES, t.status) ?? "neutral"}>
        {label("txStatus", t.status) ?? t.status}
      </Pill>
      {isOverdue(t) && <span className="text-[12px] font-medium text-destructive">vencido</span>}
    </span>
  );
  const amountCell = (t: Transaction) => (
    <span
      className={`text-[15px] font-bold tabular-nums ${
        t.direction === "IN" ? "text-success" : "text-destructive"
      }`}
    >
      {t.direction === "IN" ? "+" : "−"}
      {formatClp(t.amount_cents)}
    </span>
  );
  const rowActions = (t: Transaction) => (
    <span className="flex items-center justify-end gap-1">
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
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground"
        title="Editar"
        aria-label="Editar transacción"
        onClick={() => openEdit(t)}
      >
        <Pencil className="size-4" strokeWidth={1.8} />
      </Button>
    </span>
  );

  const transactionsBlock = (
    <>
      {isLoading && <PageSkeleton variant="list" count={5} />}
      {error && (
        <ErrorState
          message="No se pudieron cargar las transacciones."
          onRetry={() => refetch()}
          className="mx-5 lg:mx-0"
        />
      )}
      {!isLoading && !error && filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">Sin transacciones.</p>
      )}

      {!isLoading && !error && filtered.length > 0 && (
        <ResponsiveTable
          rows={filtered}
          rowKey={(t) => t.id}
          columns={
            [
              {
                key: "concepto",
                header: "Concepto",
                cell: (t) => {
                  const Icon = txIcon(t);
                  return (
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
                  );
                },
              },
              {
                key: "categoria",
                header: "Categoría",
                className: "text-muted-foreground",
                cell: (t) => categoryLabel(t.category),
              },
              { key: "estado", header: "Estado", cell: (t) => statusCell(t) },
              {
                key: "fecha",
                header: "Fecha",
                className: "tabular-nums text-muted-foreground",
                cell: (t) => dateLabel(t) ?? "—",
              },
              { key: "monto", header: "Monto", align: "right", cell: (t) => amountCell(t) },
              { key: "acciones", header: "", align: "right", cell: (t) => rowActions(t) },
            ] as ResponsiveColumn<Transaction>[]
          }
          mobileRow={(t: Transaction) => {
            const Icon = txIcon(t);
            return {
              left: (
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
                  <Icon className="size-[18px]" strokeWidth={1.8} />
                </span>
              ),
              title: t.description || categoryLabel(t.category),
              sub: (
                <span className="flex items-center gap-2">
                  {statusCell(t)}
                  <span className="truncate">
                    {txCode(t.id)}
                    {dateLabel(t) ? ` · ${dateLabel(t)}` : ""}
                  </span>
                </span>
              ),
              right: (
                <div className="flex shrink-0 items-center gap-1.5">
                  {amountCell(t)}
                  {rowActions(t)}
                </div>
              ),
            };
          }}
        />
      )}
    </>
  );

  return (
    <PageLayout width="md" noPadding className="pb-6 lg:max-w-none">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 lg:px-8 lg:pt-7">
        <div></div>
        <Button
          variant="ink"
          size="icon-lg"
          className="rounded-full"
          aria-label="Nueva transacción"
          onClick={openCreate}
        >
          <Plus className="size-5" strokeWidth={1.8} />
        </Button>
      </div>

      {/* Mobile: ink summary card (unchanged). Desktop: KPI card row. */}
      <div className="px-5 pb-4 lg:hidden">
        <div className="rounded-xl bg-foreground p-5 text-background">
          <p className="text-[13px] font-medium text-background/60">Ingresos del mes</p>
          <p className="mt-1 text-[34px] font-bold leading-none tracking-tight">
            {formatClp(summary?.income_cents ?? 0)}
          </p>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {secondaryKpis.map((s) => (
              <div key={s.label}>
                <p className="text-[11px] font-medium text-background/60">{s.label}</p>
                <p className="mt-0.5 text-[15px] font-semibold tabular-nums">
                  {formatClp(s.value)}
                </p>
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
        <div className="rounded-xl bg-foreground p-5 text-background">
          <p className="text-[13px] font-medium text-background/60">Ingresos del mes</p>
          <p className="mt-1.5 text-[28px] font-bold leading-none tracking-tight tabular-nums">
            {formatClp(summary?.income_cents ?? 0)}
          </p>
        </div>
        {secondaryKpis.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-5">
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
              {formatClp(s.value)}
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
          <TransactionFormFields idPrefix="new" value={form} onChange={setForm} />
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

      <ResponsiveSheet
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Editar transacción"
      >
        <div className="space-y-3">
          <TransactionFormFields idPrefix="edit" value={form} onChange={setForm} />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={update.isPending}>
              Cancelar
            </Button>
            <Button onClick={submitEdit} disabled={update.isPending} className="gap-2">
              {update.isPending && <Loader2 className="size-4 animate-spin" />}
              Guardar
            </Button>
          </div>
        </div>
      </ResponsiveSheet>
    </PageLayout>
  );
}

/** Shared fields for the create + edit transaction sheets. */
function TransactionFormFields({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: TxFormState;
  onChange: (next: TxFormState) => void;
}) {
  const set = <K extends keyof TxFormState>(key: K, next: TxFormState[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-direction`}>Tipo</Label>
          <select
            id={`${idPrefix}-direction`}
            value={value.direction}
            onChange={(e) => set("direction", e.target.value as TxDirection)}
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
          >
            <option value="IN">Ingreso</option>
            <option value="OUT">Gasto</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-category`}>Categoría</Label>
          <select
            id={`${idPrefix}-category`}
            value={value.category}
            onChange={(e) => set("category", e.target.value)}
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
        <Label htmlFor={`${idPrefix}-description`}>Descripción</Label>
        <Input
          id={`${idPrefix}-description`}
          value={value.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Comisión venta Los Aromos 123"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-amount`}>Monto (CLP)</Label>
        <Input
          id={`${idPrefix}-amount`}
          type="number"
          value={value.amount}
          onChange={(e) => set("amount", e.target.value)}
        />
      </div>

      <FieldGroup label="Boleta">
        <ReceiptPicker
          value={value.receiptDocumentId}
          onChange={(documentId) => set("receiptDocumentId", documentId)}
        />
      </FieldGroup>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.pending}
          onChange={(e) => set("pending", e.target.checked)}
        />
        Pendiente (por cobrar / por pagar)
      </label>

      {value.pending && (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-due`}>Vence</Label>
          <Input
            id={`${idPrefix}-due`}
            type="date"
            value={value.dueAt}
            onChange={(e) => set("dueAt", e.target.value)}
          />
        </div>
      )}
    </>
  );
}

import { useState } from "react";
import { Check, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageLayout } from "@shared/components/page-layout";
import { PageHeader } from "@shared/components/page-header";
import { toast } from "sonner";
import {
  useCompleteTransaction,
  useCreateTransaction,
  useFinanceSummary,
  useTransactions,
} from "../hooks/use-finance";
import { TX_CATEGORIES, type TxDirection } from "../api/finance-api";
import { CommissionCalculator } from "../components/commission-calculator";

function clp(cents: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-500/15 text-amber-500",
  COMPLETED: "bg-emerald-500/15 text-emerald-500",
  CANCELLED: "bg-muted text-muted-foreground",
};

export function FinancePage() {
  const { data: summary } = useFinanceSummary();
  const { data: txs, isLoading, error, refetch } = useTransactions();
  const create = useCreateTransaction();
  const complete = useCompleteTransaction();

  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<TxDirection>("IN");
  const [category, setCategory] = useState<string>("COMMISSION");
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [dueAt, setDueAt] = useState("");

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

  return (
    <PageLayout width="lg">
      <PageHeader
        title="Finanzas"
        description="Ingresos, gastos, comisiones y pagos por cobrar."
        actions={
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="size-4" />
            Nueva
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Ingresos", value: summary?.income_cents ?? 0, cls: "text-emerald-500" },
          { label: "Gastos", value: summary?.expense_cents ?? 0, cls: "text-destructive" },
          { label: "Por cobrar", value: summary?.receivable_cents ?? 0, cls: "text-amber-500" },
          { label: "Por pagar", value: summary?.payable_cents ?? 0, cls: "text-amber-500" },
        ].map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">{c.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-lg font-semibold ${c.cls}`}>{clp(c.value)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-4">
        <CommissionCalculator />
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          No se pudieron cargar las transacciones.
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      )}
      {!isLoading && !error && (txs?.length ?? 0) === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">Sin transacciones.</p>
      )}
      {!isLoading && !error && txs && txs.length > 0 && (
        <div className="divide-y rounded-lg border">
          {txs.map((t) => {
            const overdue = t.status === "PENDING" && t.due_at && new Date(t.due_at) < new Date();
            return (
              <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate">{t.description || t.category}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className={STATUS_BADGE[t.status]}>
                      {t.status === "PENDING"
                        ? "Pendiente"
                        : t.status === "COMPLETED"
                          ? "Completado"
                          : "Anulado"}
                    </Badge>
                    {overdue && <span className="text-destructive">vencido</span>}
                  </div>
                </div>
                <div
                  className={`shrink-0 font-medium ${t.direction === "IN" ? "text-emerald-500" : "text-destructive"}`}
                >
                  {t.direction === "IN" ? "+" : "−"}
                  {clp(t.amount_cents)}
                </div>
                {t.status === "PENDING" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-emerald-500"
                    title="Marcar pagado"
                    onClick={() => complete.mutate(t.id)}
                  >
                    <Check className="size-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva transacción</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as TxDirection)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
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
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {TX_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
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
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={create.isPending}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={create.isPending} className="gap-2">
              {create.isPending && <Loader2 className="size-4 animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}

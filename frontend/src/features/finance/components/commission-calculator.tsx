import { useState } from "react";
import { Calculator } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { financeApi } from "../api/finance-api";

function clp(cents: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function CommissionCalculator() {
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("2");
  const [result, setResult] = useState<{
    net_cents: number;
    iva_cents: number;
    gross_cents: number;
  } | null>(null);

  const compute = async () => {
    const amt = Number(amount);
    const r = Number(rate);
    if (!amt || !r) {
      setResult(null);
      return;
    }
    try {
      setResult(await financeApi.commissionPreview(Math.round(amt * 100), r));
    } catch {
      setResult(null);
    }
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Calculator className="size-4" strokeWidth={1.8} /> Calculadora de comisión
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Valor operación (CLP)</Label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onBlur={compute}
              type="number"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Comisión %</Label>
            <Input
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              onBlur={compute}
              type="number"
              step="0.1"
            />
          </div>
        </div>
        {result && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl bg-secondary px-3.5 py-2.5 text-sm">
            <span className="text-muted-foreground">
              Neto <span className="font-semibold text-foreground">{clp(result.net_cents)}</span>
            </span>
            <span className="text-muted-foreground">
              IVA <span className="font-semibold text-foreground">{clp(result.iva_cents)}</span>
            </span>
            <span className="text-muted-foreground">
              Total <span className="font-bold text-success">{clp(result.gross_cents)}</span>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

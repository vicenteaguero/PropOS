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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Calculator className="size-4" /> Calculadora de comisión
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Valor operación (CLP)</Label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onBlur={compute}
              type="number"
            />
          </div>
          <div className="space-y-1">
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
          <div className="flex flex-wrap gap-x-6 gap-y-1 pt-1 text-sm">
            <span>Neto: {clp(result.net_cents)}</span>
            <span className="text-muted-foreground">IVA: {clp(result.iva_cents)}</span>
            <span className="font-semibold">Total: {clp(result.gross_cents)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

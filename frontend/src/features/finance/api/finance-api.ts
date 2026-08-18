import { apiRequest } from "@features/documents/api/http";

export type TxDirection = "IN" | "OUT";
export type TxStatus = "PENDING" | "COMPLETED" | "CANCELLED";

export const TX_CATEGORIES = [
  "COMMISSION",
  "SALE_PROCEEDS",
  "RENT",
  "AD_SPEND",
  "MARKETING",
  "NOTARY_FEE",
  "TAX",
  "UTILITY",
  "SALARY",
  "SOFTWARE",
  "REIMBURSEMENT",
  "DEPOSIT",
  "REFUND",
  "TRANSFER",
  "OTHER",
] as const;

export interface Transaction {
  id: string;
  direction: TxDirection;
  category: string;
  amount_cents: number;
  currency: string;
  status: TxStatus;
  occurred_at: string | null;
  due_at: string | null;
  settled_at: string | null;
  description: string | null;
  receipt_document_id: string | null;
}

export interface TransactionInput {
  direction: TxDirection;
  category: string;
  amount_cents: number;
  status?: TxStatus;
  due_at?: string | null;
  description?: string | null;
  receipt_document_id?: string | null;
}

export interface FinanceSummary {
  month: string | null;
  income_cents: number;
  expense_cents: number;
  net_cents: number;
  receivable_cents: number;
  payable_cents: number;
}

function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const financeApi = {
  list: (params: { status?: string; direction?: string; category?: string } = {}) =>
    apiRequest<Transaction[]>(`/v1/transactions${qs({ ...params })}`),
  create: (body: TransactionInput) =>
    apiRequest<Transaction>("/v1/transactions", { method: "POST", body }),
  update: (id: string, body: Partial<TransactionInput>) =>
    apiRequest<Transaction>(`/v1/transactions/${id}`, { method: "PATCH", body }),
  complete: (id: string) =>
    apiRequest<Transaction>(`/v1/transactions/${id}/complete`, { method: "POST", body: {} }),
  remove: (id: string) => apiRequest<void>(`/v1/transactions/${id}`, { method: "DELETE" }),
  summary: (month?: string) => apiRequest<FinanceSummary>(`/v1/finance/summary${qs({ month })}`),
  commissionPreview: (amount_cents: number, rate_pct: number) =>
    apiRequest<{ net_cents: number; iva_cents: number; gross_cents: number }>(
      `/v1/finance/commission-preview${qs({ amount_cents, rate_pct })}`,
    ),
};

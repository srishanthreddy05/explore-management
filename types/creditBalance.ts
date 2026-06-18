export interface CreditBalance {
  id?: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  status: "pending" | "settled";
  type: "service" | "product";
  createdAt: string; // ISO String representation of the date
  settledAt?: string | null;
  notes?: string | null;
}

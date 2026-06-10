import type { ProductRow, ServiceRow } from "@/components/salon-dashboard/types";

export interface Invoice {
  id?: string;
  invoiceNumber: string;
  invoiceNo?: string;
  date: string;
  customerName: string;
  customerMobile: string;
  customerPhone?: string;
  services: ServiceRow[];
  products: ProductRow[];
  notes?: string;
  subtotal: number;
  discount: number; // Bill discount
  gst: number;
  grandTotal: number;
  paymentMethod?: string;
  receivedAmount?: number;
  balanceDue?: number;
  paymentStatus?: "paid" | "partial" | "unpaid" | string;
  payments?: {
    cash: number;
    upi: number;
    card: number;
  };
  totalPaid?: number;
  createdAt?: string;
}

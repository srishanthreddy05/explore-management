import type { Timestamp } from "firebase/firestore";

export interface AdvanceTransaction {
  invoiceId: string;
  type: "credit" | "debit";
  amount: number;
  balanceAfter: number;
  date: Timestamp;
  note: string;
}

export interface AdvanceBalance {
  customerId: string;
  customerName: string;
  customerPhone: string;
  balance: number;
  lastUpdated: Timestamp;
  transactions: AdvanceTransaction[];
}

import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import type { CreditBalance } from "@/types/creditBalance";

const COLLECTION_NAME = "credit_balances";

export async function create(
  credit: Omit<CreditBalance, "id" | "createdAt" | "status"> & { createdAt?: string }
): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...credit,
      remainingAmount: credit.remainingAmount ?? credit.creditAmount,
      collectionStatus: "pending",
      status: "pending",
      createdAt: credit.createdAt || new Date().toISOString(),
      settledAt: null,
    });
    return docRef.id;
  } catch (error) {
    console.error("Error creating credit balance:", error);
    throw error;
  }
}

export async function getPendingByCustomerId(customerId: string): Promise<CreditBalance[]> {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("customerId", "==", customerId),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    const results: CreditBalance[] = [];
    snap.forEach((doc) => {
      results.push({
        id: doc.id,
        ...doc.data(),
      } as CreditBalance);
    });
    return results;
  } catch (error) {
    console.error("Error getting pending credit balances by customer:", error);
    return [];
  }
}

export async function getAllPending(): Promise<CreditBalance[]> {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    const results: CreditBalance[] = [];
    snap.forEach((doc) => {
      results.push({
        id: doc.id,
        ...doc.data(),
      } as CreditBalance);
    });
    return results;
  } catch (error) {
    console.error("Error getting all pending credit balances:", error);
    return [];
  }
}
/**
 * Internal settlement helper that delegates to invoicesService.collectCreditPayment
 * ensuring all credit document and invoice updates are performed in a single atomic transaction.
 */
export async function settle(id: string, collectedAmount?: number): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error(`Credit balance document ${id} not found`);
    }
    const data = snap.data();
    const invoiceId = data.originalInvoiceId || data.invoiceId;
    if (!invoiceId) {
      throw new Error(`Credit balance document ${id} is missing an invoice reference.`);
    }

    const currentRemaining = data.remainingAmount !== undefined ? data.remainingAmount : (data.amount ?? 0);
    const amountToSettle = collectedAmount !== undefined ? collectedAmount : currentRemaining;

    const { collectCreditPayment } = await import("@/services/invoices");
    await collectCreditPayment(
      invoiceId,
      amountToSettle,
      { cash: amountToSettle, upi: 0, card: 0 }
    );
  } catch (error) {
    console.error(`Error in atomic settle for credit balance ${id}:`, error);
    throw error;
  }
}

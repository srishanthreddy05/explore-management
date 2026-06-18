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

export async function settle(id: string, providedBatch?: any): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const updateData = {
      status: "settled",
      settledAt: new Date().toISOString(),
    };
    if (providedBatch) {
      providedBatch.update(docRef, updateData);
    } else {
      await updateDoc(docRef, updateData);
    }
  } catch (error) {
    console.error(`Error settling credit balance ${id}:`, error);
    throw error;
  }
}

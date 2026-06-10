import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";
import type { Invoice } from "@/types/invoice";

const COLLECTION_NAME = "invoices";

export async function create(invoice: Omit<Invoice, "id">): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...invoice,
      createdAt: invoice.createdAt || new Date().toISOString(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error creating invoice in Firestore:", error);
    throw error;
  }
}

export async function getAll(): Promise<Invoice[]> {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy("invoiceNumber", "desc"));
    const querySnapshot = await getDocs(q);
    const invoices: Invoice[] = [];
    querySnapshot.forEach((doc) => {
      invoices.push({
        id: doc.id,
        ...doc.data(),
      } as Invoice);
    });
    return invoices;
  } catch (error) {
    console.error("Error getting all invoices from Firestore:", error);
    throw error;
  }
}

export async function getById(id: string): Promise<Invoice | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as Invoice;
    }
    return null;
  } catch (error) {
    console.error(`Error getting invoice by ID (${id}) from Firestore:`, error);
    throw error;
  }
}

export async function update(
  id: string,
  data: Partial<Omit<Invoice, "id">>
): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, data);
  } catch (error) {
    console.error(`Error updating invoice (${id}) in Firestore:`, error);
    throw error;
  }
}

async function deleteInvoice(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Error deleting invoice (${id}) from Firestore:`, error);
    throw error;
  }
}

export { deleteInvoice as delete };

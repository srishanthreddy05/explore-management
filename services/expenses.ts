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
  where,
} from "firebase/firestore";
import type { Expense } from "@/types/expense";

const COLLECTION_NAME = "expenses";

export async function create(expense: Omit<Expense, "id">): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...expense,
      createdAt: expense.createdAt || new Date().toISOString(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error creating expense:", error);
    throw error;
  }
}

export async function getAll(): Promise<Expense[]> {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy("date", "desc"));
    const querySnapshot = await getDocs(q);
    const expenses: Expense[] = [];
    querySnapshot.forEach((doc) => {
      expenses.push({
        id: doc.id,
        ...doc.data(),
      } as Expense);
    });
    return expenses;
  } catch (error) {
    console.error("Error getting all expenses:", error);
    throw error;
  }
}

export async function getByDateRange(startDate: Date, endDate: Date): Promise<Expense[]> {
  try {
    const startStr = startDate.toISOString().split("T")[0];
    const endStr = endDate.toISOString().split("T")[0];
    const q = query(
      collection(db, COLLECTION_NAME),
      where("date", ">=", startStr),
      where("date", "<=", endStr),
      orderBy("date", "desc")
    );
    const querySnapshot = await getDocs(q);
    const expenses: Expense[] = [];
    querySnapshot.forEach((doc) => {
      expenses.push({
        id: doc.id,
        ...doc.data(),
      } as Expense);
    });
    return expenses;
  } catch (error) {
    console.error("Error getting expenses by date range:", error);
    throw error;
  }
}

export async function getById(id: string): Promise<Expense | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as Expense;
    }
    return null;
  } catch (error) {
    console.error(`Error getting expense by ID (${id}):`, error);
    throw error;
  }
}

export async function update(
  id: string,
  data: Partial<Omit<Expense, "id">>
): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, data);
  } catch (error) {
    console.error(`Error updating expense (${id}):`, error);
    throw error;
  }
}

async function deleteExpense(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Error deleting expense (${id}):`, error);
    throw error;
  }
}

export { deleteExpense as delete };

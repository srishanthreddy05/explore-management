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
  where,
  orderBy,
} from "firebase/firestore";
import type { Customer } from "@/types/customer";

const COLLECTION_NAME = "customers";

export async function create(customer: Omit<Customer, "id">): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      name: customer.name,
      phone: customer.phone,
      customerType: customer.customerType,
      createdAt: customer.createdAt || new Date().toISOString(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error creating customer in Firestore:", error);
    throw error;
  }
}

export async function getAll(): Promise<Customer[]> {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy("name", "asc"));
    const querySnapshot = await getDocs(q);
    const customers: Customer[] = [];
    querySnapshot.forEach((doc) => {
      customers.push({
        id: doc.id,
        ...doc.data(),
      } as Customer);
    });
    return customers;
  } catch (error) {
    console.error("Error getting all customers from Firestore:", error);
    throw error;
  }
}

export async function getById(id: string): Promise<Customer | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as Customer;
    }
    return null;
  } catch (error) {
    console.error(`Error getting customer by ID (${id}) from Firestore:`, error);
    throw error;
  }
}

export async function getByPhone(phone: string): Promise<Customer | null> {
  try {
    const q = query(collection(db, COLLECTION_NAME), where("phone", "==", phone));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const firstDoc = querySnapshot.docs[0];
      return {
        id: firstDoc.id,
        ...firstDoc.data(),
      } as Customer;
    }
    return null;
  } catch (error) {
    console.error(`Error getting customer by phone (${phone}) from Firestore:`, error);
    throw error;
  }
}

export async function update(
  id: string,
  data: Partial<Omit<Customer, "id">>
): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, data);
  } catch (error) {
    console.error(`Error updating customer (${id}) in Firestore:`, error);
    throw error;
  }
}

async function deleteCustomer(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Error deleting customer (${id}) from Firestore:`, error);
    throw error;
  }
}

export { deleteCustomer as delete };

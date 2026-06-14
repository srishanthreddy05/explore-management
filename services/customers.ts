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
  setDoc,
  increment,
  runTransaction,
} from "firebase/firestore";
import type { Customer } from "@/types/customer";
import { toTitleCase } from "@/lib/utils/text";

const COLLECTION_NAME = "customers";
const STATS_DOC = doc(db, "stats", "customers");

export async function getStats(): Promise<{ regularCount: number; membershipCount: number }> {
  try {
    const snap = await getDoc(STATS_DOC);
    if (snap.exists()) {
      const data = snap.data();
      return {
        regularCount: data.regularCount || 0,
        membershipCount: data.membershipCount || 0,
      };
    }
    return { regularCount: 0, membershipCount: 0 };
  } catch (error) {
    console.error("Error getting customer stats:", error);
    return { regularCount: 0, membershipCount: 0 };
  }
}

export async function create(customer: Omit<Customer, "id">): Promise<string> {
  try {
    const newDocRef = doc(collection(db, COLLECTION_NAME));
    const isMembership = customer.customerType === "membership";
    const counterField = isMembership ? "membershipCount" : "regularCount";

    await runTransaction(db, async (transaction) => {
      // Set customer document inside the transaction
      transaction.set(newDocRef, {
        name: toTitleCase(customer.name),
        phone: customer.phone,
        customerType: customer.customerType,
        createdAt: customer.createdAt || new Date().toISOString(),
      });

      // Increment stats counter inside the same transaction
      transaction.set(STATS_DOC, {
        [counterField]: increment(1)
      }, { merge: true });
    });

    return newDocRef.id;
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
    const normalizedData = { ...data };
    if (normalizedData.name) {
      normalizedData.name = toTitleCase(normalizedData.name);
    }

    await runTransaction(db, async (transaction) => {
      // 1. Transaction read
      const oldDocSnap = await transaction.get(docRef);
      if (!oldDocSnap.exists()) {
        throw new Error("Customer document does not exist");
      }

      const oldType = oldDocSnap.data().customerType || "regular";
      const newType = normalizedData.customerType;

      // 2. Transaction writes
      if (newType && oldType !== newType) {
        const oldField = oldType === "membership" ? "membershipCount" : "regularCount";
        const newField = newType === "membership" ? "membershipCount" : "regularCount";
        transaction.set(STATS_DOC, {
          [oldField]: increment(-1),
          [newField]: increment(1)
        }, { merge: true });
      }

      transaction.update(docRef, normalizedData as Record<string, any>);
    });
  } catch (error) {
    console.error(`Error updating customer (${id}) in Firestore:`, error);
    throw error;
  }
}

async function deleteCustomer(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);

    await runTransaction(db, async (transaction) => {
      // 1. Transaction read
      const docSnap = await transaction.get(docRef);
      if (docSnap.exists()) {
        const customer = docSnap.data();
        const isMembership = customer.customerType === "membership";
        const counterField = isMembership ? "membershipCount" : "regularCount";

        // 2. Transaction writes
        transaction.set(STATS_DOC, {
          [counterField]: increment(-1)
        }, { merge: true });
      }

      transaction.delete(docRef);
    });
  } catch (error) {
    console.error(`Error deleting customer (${id}) from Firestore:`, error);
    throw error;
  }
}

export { deleteCustomer as delete };

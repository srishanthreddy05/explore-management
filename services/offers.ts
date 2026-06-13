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
import type { Offer } from "@/types/offer";

const COLLECTION_NAME = "offers";

// Firestore rejects `undefined` field values, so strip them before writing.
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out as T;
}

export async function create(offer: Omit<Offer, "id">): Promise<string> {
  try {
    const docRef = await addDoc(
      collection(db, COLLECTION_NAME),
      stripUndefined({
        ...offer,
        createdAt: offer.createdAt || new Date().toISOString(),
      })
    );
    return docRef.id;
  } catch (error) {
    console.error("Error creating offer:", error);
    throw error;
  }
}

export async function getAll(): Promise<Offer[]> {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy("code", "asc"));
    const querySnapshot = await getDocs(q);
    const offers: Offer[] = [];
    querySnapshot.forEach((doc) => {
      offers.push({
        id: doc.id,
        ...doc.data(),
      } as Offer);
    });
    return offers;
  } catch (error) {
    console.error("Error getting all offers:", error);
    throw error;
  }
}

export async function getById(id: string): Promise<Offer | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as Offer;
    }
    return null;
  } catch (error) {
    console.error(`Error getting offer by ID (${id}):`, error);
    throw error;
  }
}

export async function update(
  id: string,
  data: Partial<Omit<Offer, "id">>
): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, stripUndefined(data));
  } catch (error) {
    console.error(`Error updating offer (${id}):`, error);
    throw error;
  }
}

async function deleteOffer(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Error deleting offer (${id}):`, error);
    throw error;
  }
}

export { deleteOffer as delete };
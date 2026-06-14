import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import type { Service } from "@/types/service";
import { toTitleCase } from "@/lib/utils/text";

const COLLECTION_NAME = "services";

export async function create(service: Omit<Service, "id">): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...service,
      name: toTitleCase(service.name),
      ...(service.category ? { category: toTitleCase(service.category) } : {}),
      isActive: true,
      createdAt: service.createdAt || new Date().toISOString(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error creating service in Firestore:", error);
    throw error;
  }
}

export async function getAll(): Promise<Service[]> {
  try {
    // ── FIX: use isActive == true instead of != false ──────────────────────
    // Firestore allows a single == filter combined with a single orderBy on a
    // DIFFERENT field without requiring a composite index. The previous
    // (!= false + orderBy("isActive") + orderBy("name")) combination required
    // a manually-created composite index that didn't exist, causing a
    // FirebaseError at runtime.
    const q = query(
      collection(db, COLLECTION_NAME),
      where("isActive", "==", true),
      orderBy("name", "asc")
    );
    const querySnapshot = await getDocs(q);
    const services: Service[] = [];
    querySnapshot.forEach((doc) => {
      services.push({ id: doc.id, ...doc.data() } as Service);
    });
    return services;
  } catch (error) {
    console.error("Error getting all services from Firestore:", error);
    throw error;
  }
}

async function deleteService(id: string): Promise<void> {
  try {
    await updateDoc(doc(db, COLLECTION_NAME, id), { isActive: false });
  } catch (error) {
    console.error(`Error soft-deleting service (${id}):`, error);
    throw error;
  }
}

export async function getById(id: string): Promise<Service | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as Service;
    }
    return null;
  } catch (error) {
    console.error(`Error getting service by ID (${id}) from Firestore:`, error);
    throw error;
  }
}

export async function update(
  id: string,
  data: Partial<Omit<Service, "id">>
): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const normalizedData = { ...data };
    if (normalizedData.name) {
      normalizedData.name = toTitleCase(normalizedData.name);
    }
    if (normalizedData.category) {
      normalizedData.category = toTitleCase(normalizedData.category);
    }
    await updateDoc(docRef, normalizedData);
  } catch (error) {
    console.error(`Error updating service (${id}) in Firestore:`, error);
    throw error;
  }
}

export { deleteService as delete };
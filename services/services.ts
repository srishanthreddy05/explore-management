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
import type { Service } from "@/types/service";

const COLLECTION_NAME = "services";

export async function create(service: Omit<Service, "id">): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...service,
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
    const q = query(collection(db, COLLECTION_NAME), orderBy("name", "asc"));
    const querySnapshot = await getDocs(q);
    const services: Service[] = [];
    querySnapshot.forEach((doc) => {
      services.push({
        id: doc.id,
        ...doc.data(),
      } as Service);
    });
    return services;
  } catch (error) {
    console.error("Error getting all services from Firestore:", error);
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
    await updateDoc(docRef, data);
  } catch (error) {
    console.error(`Error updating service (${id}) in Firestore:`, error);
    throw error;
  }
}

async function deleteService(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Error deleting service (${id}) from Firestore:`, error);
    throw error;
  }
}

export { deleteService as delete };

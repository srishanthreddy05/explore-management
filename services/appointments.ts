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
import type { Appointment } from "@/types/appointment";

const COLLECTION_NAME = "appointments";

export async function create(
  appointment: Omit<Appointment, "id">
): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...appointment,
      createdAt: appointment.createdAt || new Date().toISOString(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error creating appointment in Firestore:", error);
    throw error;
  }
}

export async function getAll(): Promise<Appointment[]> {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy("dateTime", "asc"));
    const querySnapshot = await getDocs(q);
    const appointments: Appointment[] = [];
    querySnapshot.forEach((doc) => {
      appointments.push({
        id: doc.id,
        ...doc.data(),
      } as Appointment);
    });
    return appointments;
  } catch (error) {
    console.error("Error getting all appointments from Firestore:", error);
    throw error;
  }
}

export async function getById(id: string): Promise<Appointment | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as Appointment;
    }
    return null;
  } catch (error) {
    console.error(`Error getting appointment by ID (${id}) from Firestore:`, error);
    throw error;
  }
}

export async function update(
  id: string,
  data: Partial<Omit<Appointment, "id">>
): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, data);
  } catch (error) {
    console.error(`Error updating appointment (${id}) in Firestore:`, error);
    throw error;
  }
}

async function deleteAppointment(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Error deleting appointment (${id}) from Firestore:`, error);
    throw error;
  }
}

export { deleteAppointment as delete };

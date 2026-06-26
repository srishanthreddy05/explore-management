import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  addDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

export interface StaffDrawing {
  id?: string;
  staffId: string;
  staffName: string;
  amount: number;
  note?: string;
  date: string;  // "YYYY-MM-DD"
  month: string; // "YYYY-MM"
  createdAt?: Timestamp;
}

const COLLECTION_NAME = "staffDrawings";

export async function addDrawing(drawing: Omit<StaffDrawing, "id" | "createdAt">): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...drawing,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding staff drawing:", error);
    throw error;
  }
}

export async function getDrawingsByStaffAndMonth(
  staffId: string,
  month: string
): Promise<StaffDrawing[]> {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("staffId", "==", staffId),
      where("month", "==", month)
    );
    const querySnapshot = await getDocs(q);
    const drawings: StaffDrawing[] = [];
    querySnapshot.forEach((doc) => {
      drawings.push({
        id: doc.id,
        ...doc.data(),
      } as StaffDrawing);
    });
    // Sort client-side by date desc to avoid composite index requirements
    drawings.sort((a, b) => b.date.localeCompare(a.date));
    return drawings;
  } catch (error) {
    console.error("Error getting staff drawings:", error);
    throw error;
  }
}

export async function deleteDrawing(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting staff drawing:", error);
    throw error;
  }
}

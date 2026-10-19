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

export type StaffPaymentMethod = "Cash" | "UPI" | "Bank Transfer" | "Cheque" | "Other";
export type StaffPaymentType = "payout" | "advance" | "adjustment";

export interface StaffDrawing {
  id?: string;
  staffId: string;
  staffName: string;
  amount: number;
  note?: string;
  date: string;  // "YYYY-MM-DD"
  month: string; // "YYYY-MM"
  paymentMethod?: StaffPaymentMethod;
  type?: StaffPaymentType;
  referenceNumber?: string;
  recordedBy?: string;
  createdAt?: Timestamp | any;
}

const COLLECTION_NAME = "staffDrawings";

export async function addDrawing(drawing: Omit<StaffDrawing, "id" | "createdAt">): Promise<string> {
  try {
    if (!drawing.staffId || !drawing.staffName) {
      throw new Error("Stylist is required.");
    }
    const amt = Number(drawing.amount);
    if (isNaN(amt) || amt <= 0) {
      throw new Error("Payment amount must be greater than 0.");
    }
    if (!drawing.date) {
      throw new Error("Payment date is required.");
    }

    const month = drawing.month || drawing.date.slice(0, 7);

    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...drawing,
      amount: amt,
      month,
      type: drawing.type || "payout",
      paymentMethod: drawing.paymentMethod || "Cash",
      note: drawing.note?.trim() || undefined,
      referenceNumber: drawing.referenceNumber?.trim() || undefined,
      recordedBy: drawing.recordedBy || "Owner",
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding staff drawing:", error);
    throw error;
  }
}

export async function getAllDrawings(): Promise<StaffDrawing[]> {
  try {
    const snap = await getDocs(collection(db, COLLECTION_NAME));
    const drawings: StaffDrawing[] = [];
    snap.forEach((d) => {
      drawings.push({ id: d.id, ...d.data() } as StaffDrawing);
    });
    drawings.sort((a, b) => b.date.localeCompare(a.date));
    return drawings;
  } catch (error) {
    console.error("Error getting all staff drawings:", error);
    throw error;
  }
}

export async function getDrawingsByMonth(month: string): Promise<StaffDrawing[]> {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("month", "==", month)
    );
    const snap = await getDocs(q);
    const drawings: StaffDrawing[] = [];
    snap.forEach((d) => {
      drawings.push({ id: d.id, ...d.data() } as StaffDrawing);
    });
    drawings.sort((a, b) => b.date.localeCompare(a.date));
    return drawings;
  } catch (error) {
    console.error("Error getting drawings by month:", error);
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


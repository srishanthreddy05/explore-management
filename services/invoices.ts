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
  runTransaction,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import type { Invoice } from "@/types/invoice";
import { toTitleCase } from "@/lib/utils/text";

const COLLECTION = "invoices";
const COUNTER_DOC = doc(db, "counters", "invoice");  // /counters/invoice { lastNumber: 1000 }

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Atomically increments the daily counter document inside /counters/invoices_YYMMDD
 * and returns the next invoice number string. Safe under concurrent billing sessions.
 */
async function getNextInvoiceNumber(): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateStr = `${yy}${mm}${dd}`; // "260614"

  const dailyCounterDoc = doc(db, "counters", `invoices_${dateStr}`);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(dailyCounterDoc);

    let last = 0;
    if (snap.exists()) {
      last = snap.data().current ?? 0;
    }

    const next = last + 1;
    tx.set(dailyCounterDoc, { current: next });

    const formattedSeq = String(next).padStart(3, '0');
    return `EXP-${dateStr}-${formattedSeq}`;
  });
}

// ── Exported helpers the billing page needs ───────────────────────────────────

export { getNextInvoiceNumber };

// ── CRUD ──────────────────────────────────────────────────────────────────────

/**
 * Save a new invoice. Invoice number must come from getNextInvoiceNumber()
 * called by the billing page — do not pass a client-generated number.
 */
export async function create(
  invoice: Omit<Invoice, "id" | "createdAt" | "date"> & { dateString: string }
): Promise<string> {
  try {
    // Convert the YYYY-MM-DD string the date input gives us into a Firestore Timestamp
    const dateTs = Timestamp.fromDate(new Date(invoice.dateString));

    const { dateString, ...rest } = invoice;

    const normalizedServices = rest.services?.map((s: any) => ({
      ...s,
      serviceName: s.serviceName ? toTitleCase(s.serviceName) : s.serviceName,
      staffName: s.staffName ? toTitleCase(s.staffName) : s.staffName,
    }));

    const normalizedProducts = rest.products?.map((p: any) => ({
      ...p,
      productName: p.productName ? toTitleCase(p.productName) : p.productName,
    }));

    const normalizedAppliedOffer = rest.appliedOffer
      ? {
          ...rest.appliedOffer,
          name: rest.appliedOffer.name ? toTitleCase(rest.appliedOffer.name) : rest.appliedOffer.name,
        }
      : undefined;

    // Create invoiceDate combining selected date with current time
    const now = new Date();
    const selectedDate = new Date(invoice.dateString);
    selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    const invoiceDate = Timestamp.fromDate(selectedDate);

    // Compute dateKey (YYYY-MM-DD) and timeKey (HH:MM:SS) in local browser time
    const yyyy = now.getFullYear();
    const mmStr = String(now.getMonth() + 1).padStart(2, '0');
    const ddStr = String(now.getDate()).padStart(2, '0');
    const dateKey = `${yyyy}-${mmStr}-${ddStr}`;

    const hhStr = String(now.getHours()).padStart(2, '0');
    const minStr = String(now.getMinutes()).padStart(2, '0');
    const secStr = String(now.getSeconds()).padStart(2, '0');
    const timeKey = `${hhStr}:${minStr}:${secStr}`;

    const docRef = await addDoc(collection(db, COLLECTION), {
      ...rest,
      customerName: toTitleCase(rest.customerName),
      services: normalizedServices,
      products: normalizedProducts,
      ...(normalizedAppliedOffer ? { appliedOffer: normalizedAppliedOffer } : {}),
      date: dateTs,
      invoiceDate,
      createdAt: serverTimestamp(),
      dateKey,
      timeKey,
    });
    return docRef.id;
  } catch (error) {
    console.error("Error creating invoice:", error);
    throw error;
  }
}

/**
 * Returns all invoices ordered by date descending (newest first).
 * NOTE: for high-volume stores, switch this to a paginated cursor query.
 */
export async function getAll(): Promise<Invoice[]> {
  try {
    const q = query(collection(db, COLLECTION), orderBy("date", "desc"));
    const snap = await getDocs(q);
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invoice));

    return docs.sort((a, b) => {
      const dateA = a.invoiceDate || a.date;
      const dateB = b.invoiceDate || b.date;
      const timeA = dateA && typeof dateA.toMillis === "function" ? dateA.toMillis() : 0;
      const timeB = dateB && typeof dateB.toMillis === "function" ? dateB.toMillis() : 0;
      if (timeB !== timeA) return timeB - timeA;

      const createdA = a.createdAt && typeof a.createdAt.toMillis === "function" ? a.createdAt.toMillis() : 0;
      const createdB = b.createdAt && typeof b.createdAt.toMillis === "function" ? b.createdAt.toMillis() : 0;
      return createdB - createdA;
    });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    throw error;
  }
}

export async function getByDateRange(startDate: Date, endDate: Date): Promise<Invoice[]> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where("date", ">=", Timestamp.fromDate(startDate)),
      where("date", "<=", Timestamp.fromDate(endDate)),
      orderBy("date", "desc")
    );
    const snap = await getDocs(q);
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invoice));

    return docs.sort((a, b) => {
      const dateA = a.invoiceDate || a.date;
      const dateB = b.invoiceDate || b.date;
      const timeA = dateA && typeof dateA.toMillis === "function" ? dateA.toMillis() : 0;
      const timeB = dateB && typeof dateB.toMillis === "function" ? dateB.toMillis() : 0;
      if (timeB !== timeA) return timeB - timeA;

      const createdA = a.createdAt && typeof a.createdAt.toMillis === "function" ? a.createdAt.toMillis() : 0;
      const createdB = b.createdAt && typeof b.createdAt.toMillis === "function" ? b.createdAt.toMillis() : 0;
      return createdB - createdA;
    });
  } catch (error) {
    console.error("Error fetching invoices by date range:", error);
    throw error;
  }
}

export async function getById(id: string): Promise<Invoice | null> {
  try {
    const snap = await getDoc(doc(db, COLLECTION, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Invoice;
  } catch (error) {
    console.error(`Error fetching invoice ${id}:`, error);
    throw error;
  }
}

export async function update(
  id: string,
  data: Partial<Omit<Invoice, "id">>
): Promise<void> {
  try {
    const normalizedData = { ...data } as any;
    if (normalizedData.customerName) {
      normalizedData.customerName = toTitleCase(normalizedData.customerName);
    }
    if (normalizedData.services) {
      normalizedData.services = normalizedData.services.map((s: any) => ({
        ...s,
        serviceName: s.serviceName ? toTitleCase(s.serviceName) : s.serviceName,
        staffName: s.staffName ? toTitleCase(s.staffName) : s.staffName,
      }));
    }
    if (normalizedData.products) {
      normalizedData.products = normalizedData.products.map((p: any) => ({
        ...p,
        productName: p.productName ? toTitleCase(p.productName) : p.productName,
      }));
    }
    if (normalizedData.appliedOffer) {
      normalizedData.appliedOffer = {
        ...normalizedData.appliedOffer,
        name: normalizedData.appliedOffer.name ? toTitleCase(normalizedData.appliedOffer.name) : normalizedData.appliedOffer.name,
      };
    }
    await updateDoc(doc(db, COLLECTION, id), normalizedData as Record<string, unknown>);
  } catch (error) {
    console.error(`Error updating invoice ${id}:`, error);
    throw error;
  }
}

async function deleteInvoice(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTION, id));
  } catch (error) {
    console.error(`Error deleting invoice ${id}:`, error);
    throw error;
  }
}

export { deleteInvoice as delete };
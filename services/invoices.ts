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
  increment,
  writeBatch,
} from "firebase/firestore";
import type { Invoice } from "@/types/invoice";
import { toTitleCase } from "@/lib/utils/text";
import { toLocalDateString } from "@/lib/utils/date";
import { getInvoicePayments, getInvoicePaymentRatio, getServiceCommission } from "@/lib/utils/settlements";
import { allocateCreditPayment } from "@/lib/utils/creditTracker";

const COLLECTION = "invoices";
const COUNTER_DOC = doc(db, "counters", "invoice");  // /counters/invoice { lastNumber: 1000 }

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Atomically increments the daily counter document inside /counters/invoices_YYMMDD
 * and returns the next invoice number string. Safe under concurrent billing sessions.
 */
async function getNextInvoiceNumber(dateString?: string): Promise<string> {
  const selectedDate = dateString ? new Date(dateString) : new Date();
  const yy = String(selectedDate.getFullYear()).slice(-2);
  const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
  const dd = String(selectedDate.getDate()).padStart(2, '0');
  const dateStr = `${yy}${mm}${dd}`; // e.g. "260614"

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

function getInvoiceDateKeys(invoice: any): { dateKey: string; monthKey: string } {
  let dateKey = "";
  if (invoice.billDate) {
    dateKey = toLocalDateString(invoice.billDate);
  } else if (invoice.date) {
    dateKey = toLocalDateString(invoice.date);
  } else {
    dateKey = invoice.dateKey || toLocalDateString(new Date());
  }
  return {
    dateKey,
    monthKey: dateKey.slice(0, 7),
  };
}

function summarizeStaffServices(services: any[], inv: any): Record<string, { revenue: number; servicesCount: number; productCost: number }> {
  const summary: Record<string, { revenue: number; servicesCount: number; productCost: number }> = {};
  services.forEach((s: any) => {
    const staffId = s.staffId || "unassigned";
    if (!summary[staffId]) {
      summary[staffId] = { revenue: 0, servicesCount: 0, productCost: 0 };
    }
    let amount: number;
    if (s.amount !== undefined && s.amount !== null) {
      amount = s.amount;
    } else {
      const serviceBaseAmount = Math.max((s.price || 0) - (s.discount || 0), 0);
      const discountFactor = inv && inv.subtotal > 0 ? (inv.grandTotal / inv.subtotal) : 1;
      amount = serviceBaseAmount * discountFactor;
    }
    const cost = s.usedProductCost || 0;
    summary[staffId].revenue += amount;
    summary[staffId].servicesCount += 1;
    summary[staffId].productCost += cost;
  });
  return summary;
}

export function applyStatsAndInventoryDiff(
  batch: any, // WriteBatch or Transaction
  oldInv: any | null,
  newInv: any | null
) {
  const monthlyChanges: Record<string, { totalRevenue: number; totalVisits: number; cash: number; upi: number; card: number }> = {};
  const dailyChanges: Record<string, {
    totalRevenue: number;
    totalVisits: number;
    cash: number;
    upi: number;
    card: number;
    serviceRevenue: number;
    productCost: number;
    stylistShare: number;
    ownerShare: number;
    totalMembershipAmount: number;
    retailProductsRevenue: number;
  }> = {};
  const staffChanges: Record<string, { revenue: number; servicesCount: number; visits: number; productCost: number }> = {};

  const productQuantityChanges: Record<string, number> = {};

  const oldRatio = oldInv ? getInvoicePaymentRatio(oldInv) : 1;
  const newRatio = newInv ? getInvoicePaymentRatio(newInv) : 1;

  // 1. Process old invoice subtractions
  if (oldInv) {
    const { dateKey, monthKey } = getInvoiceDateKeys(oldInv);
    
    if (!monthlyChanges[monthKey]) {
      monthlyChanges[monthKey] = { totalRevenue: 0, totalVisits: 0, cash: 0, upi: 0, card: 0 };
    }
    const oldPayments = getInvoicePayments(oldInv);
    const oldCollected = (oldPayments.cash || 0) + (oldPayments.upi || 0) + (oldPayments.card || 0) + (oldInv.advanceUsed || 0);

    monthlyChanges[monthKey].totalRevenue -= oldCollected;
    monthlyChanges[monthKey].totalVisits -= 1;
    monthlyChanges[monthKey].cash -= oldPayments.cash;
    monthlyChanges[monthKey].upi -= oldPayments.upi;
    monthlyChanges[monthKey].card -= oldPayments.card;

    if (!dailyChanges[dateKey]) {
      dailyChanges[dateKey] = { totalRevenue: 0, totalVisits: 0, cash: 0, upi: 0, card: 0, serviceRevenue: 0, productCost: 0, stylistShare: 0, ownerShare: 0, totalMembershipAmount: 0, retailProductsRevenue: 0 };
    }
    dailyChanges[dateKey].totalRevenue -= oldCollected;
    dailyChanges[dateKey].totalVisits -= 1;
    dailyChanges[dateKey].cash -= oldPayments.cash;
    dailyChanges[dateKey].upi -= oldPayments.upi;
    dailyChanges[dateKey].card -= oldPayments.card;
    (oldInv.services || []).forEach((s: any) => {
      const comm = getServiceCommission(s, oldInv);
      dailyChanges[dateKey].serviceRevenue -= comm.serviceRevenue * oldRatio;
      dailyChanges[dateKey].productCost -= comm.productCost * oldRatio;
      dailyChanges[dateKey].stylistShare -= comm.stylistShare * oldRatio;
      dailyChanges[dateKey].ownerShare -= comm.ownerShare * oldRatio;
      if (s.serviceId === "membership_fee") {
        dailyChanges[dateKey].totalMembershipAmount -= comm.serviceRevenue * oldRatio;
      }
    });

    const oldDiscountFactor = oldInv.subtotal > 0 ? (oldInv.grandTotal / oldInv.subtotal) : 1;
    (oldInv.products || []).forEach((p: any) => {
      const productBaseAmount = p.amount ?? Math.max((p.price || 0) * (p.quantity || 1) - (p.discount || 0), 0);
      const amount = productBaseAmount * oldDiscountFactor;
      dailyChanges[dateKey].ownerShare -= amount * oldRatio;
      dailyChanges[dateKey].retailProductsRevenue -= amount * oldRatio;
    });

    const staffSummary = summarizeStaffServices(oldInv.services || [], oldInv);
    Object.entries(staffSummary).forEach(([staffId, summary]) => {
      const staffMonthKey = `${staffId}_${monthKey}`;
      if (!staffChanges[staffMonthKey]) {
        staffChanges[staffMonthKey] = { revenue: 0, servicesCount: 0, visits: 0, productCost: 0 };
      }
      staffChanges[staffMonthKey].revenue -= summary.revenue * oldRatio;
      staffChanges[staffMonthKey].servicesCount -= summary.servicesCount;
      staffChanges[staffMonthKey].visits -= 1;
      staffChanges[staffMonthKey].productCost -= summary.productCost * oldRatio;
    });

    (oldInv.products || []).forEach((p: any) => {
      if (p.productId) {
        productQuantityChanges[p.productId] = (productQuantityChanges[p.productId] || 0) + (p.quantity || 1);
      }
    });
  }

  // 2. Process new invoice additions
  if (newInv) {
    const { dateKey, monthKey } = getInvoiceDateKeys(newInv);

    if (!monthlyChanges[monthKey]) {
      monthlyChanges[monthKey] = { totalRevenue: 0, totalVisits: 0, cash: 0, upi: 0, card: 0 };
    }
    const newPayments = getInvoicePayments(newInv);
    const newCollected = (newPayments.cash || 0) + (newPayments.upi || 0) + (newPayments.card || 0) + (newInv.advanceUsed || 0);

    monthlyChanges[monthKey].totalRevenue += newCollected;
    monthlyChanges[monthKey].totalVisits += 1;
    monthlyChanges[monthKey].cash += newPayments.cash;
    monthlyChanges[monthKey].upi += newPayments.upi;
    monthlyChanges[monthKey].card += newPayments.card;

    if (!dailyChanges[dateKey]) {
      dailyChanges[dateKey] = { totalRevenue: 0, totalVisits: 0, cash: 0, upi: 0, card: 0, serviceRevenue: 0, productCost: 0, stylistShare: 0, ownerShare: 0, totalMembershipAmount: 0, retailProductsRevenue: 0 };
    }
    dailyChanges[dateKey].totalRevenue += newCollected;
    dailyChanges[dateKey].totalVisits += 1;
    dailyChanges[dateKey].cash += newPayments.cash;
    dailyChanges[dateKey].upi += newPayments.upi;
    dailyChanges[dateKey].card += newPayments.card;
    (newInv.services || []).forEach((s: any) => {
      const comm = getServiceCommission(s, newInv);
      dailyChanges[dateKey].serviceRevenue += comm.serviceRevenue * newRatio;
      dailyChanges[dateKey].productCost += comm.productCost * newRatio;
      dailyChanges[dateKey].stylistShare += comm.stylistShare * newRatio;
      dailyChanges[dateKey].ownerShare += comm.ownerShare * newRatio;
      if (s.serviceId === "membership_fee") {
        dailyChanges[dateKey].totalMembershipAmount += comm.serviceRevenue * newRatio;
      }
    });

    const newDiscountFactor = newInv.subtotal > 0 ? (newInv.grandTotal / newInv.subtotal) : 1;
    (newInv.products || []).forEach((p: any) => {
      const productBaseAmount = p.amount ?? Math.max((p.price || 0) * (p.quantity || 1) - (p.discount || 0), 0);
      const amount = productBaseAmount * newDiscountFactor;
      dailyChanges[dateKey].ownerShare += amount * newRatio;
      dailyChanges[dateKey].retailProductsRevenue += amount * newRatio;
    });

    const staffSummary = summarizeStaffServices(newInv.services || [], newInv);
    Object.entries(staffSummary).forEach(([staffId, summary]) => {
      const staffMonthKey = `${staffId}_${monthKey}`;
      if (!staffChanges[staffMonthKey]) {
        staffChanges[staffMonthKey] = { revenue: 0, servicesCount: 0, visits: 0, productCost: 0 };
      }
      staffChanges[staffMonthKey].revenue += summary.revenue * newRatio;
      staffChanges[staffMonthKey].servicesCount += summary.servicesCount;
      staffChanges[staffMonthKey].visits += 1;
      staffChanges[staffMonthKey].productCost += summary.productCost * newRatio;
    });

    (newInv.products || []).forEach((p: any) => {
      if (p.productId) {
        productQuantityChanges[p.productId] = (productQuantityChanges[p.productId] || 0) - (p.quantity || 1);
      }
    });
  }

  // Write changes to batch/transaction
  Object.entries(monthlyChanges).forEach(([monthKey, change]) => {
    if (change.totalRevenue === 0 && change.totalVisits === 0 && change.cash === 0 && change.upi === 0 && change.card === 0) return;
    const ref = doc(db, "stats", `revenue_${monthKey}`);
    batch.set(ref, {
      totalRevenue: increment(change.totalRevenue),
      totalVisits: increment(change.totalVisits),
      cash: increment(change.cash),
      upi: increment(change.upi),
      card: increment(change.card)
    }, { merge: true });
  });

  Object.entries(dailyChanges).forEach(([dateKey, change]) => {
    const isZero =
      change.totalRevenue === 0 &&
      change.totalVisits === 0 &&
      change.cash === 0 &&
      change.upi === 0 &&
      change.card === 0 &&
      change.serviceRevenue === 0 &&
      change.productCost === 0 &&
      change.stylistShare === 0 &&
      change.ownerShare === 0 &&
      change.totalMembershipAmount === 0;
    if (isZero) return;

    const ref = doc(db, "stats", `daily_${dateKey}`);
    batch.set(ref, {
      dateKey,
      totalRevenue: increment(change.totalRevenue),
      totalVisits: increment(change.totalVisits),
      cash: increment(change.cash),
      upi: increment(change.upi),
      card: increment(change.card),
      serviceRevenue: increment(change.serviceRevenue),
      productCost: increment(change.productCost),
      stylistShare: increment(change.stylistShare),
      ownerShare: increment(change.ownerShare),
      totalMembershipAmount: increment(change.totalMembershipAmount),
      retailProductsRevenue: increment(change.retailProductsRevenue)
    }, { merge: true });
  });

  Object.entries(staffChanges).forEach(([staffMonthKey, change]) => {
    if (change.revenue === 0 && change.servicesCount === 0 && change.visits === 0 && change.productCost === 0) return;
    const [staffId, monthKey] = staffMonthKey.split("_");
    const ref = doc(db, "stats", `staff_${staffId}_${monthKey}`);
    batch.set(ref, {
      revenue: increment(change.revenue),
      servicesCount: increment(change.servicesCount),
      visits: increment(change.visits),
      productCost: increment(change.productCost)
    }, { merge: true });
  });

  Object.entries(productQuantityChanges).forEach(([prodId, qtyChange]) => {
    if (qtyChange === 0) return;
    const ref = doc(db, "products", prodId);
    batch.update(ref, { quantity: increment(qtyChange) });
  });
}

/**
 * Save a new invoice. Invoice number must come from getNextInvoiceNumber()
 * called by the billing page — do not pass a client-generated number.
 */
export async function create(
  invoice: Omit<Invoice, "id" | "createdAt" | "date"> & { dateString: string },
  providedBatch?: any,
  providedDocRef?: any
): Promise<string> {
  try {
    const selectedDateMidnight = new Date(invoice.dateString);
    selectedDateMidnight.setHours(0, 0, 0, 0);
    const dateTs = Timestamp.fromDate(selectedDateMidnight);
    
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

    const now = new Date();
    const selectedDate = new Date(invoice.dateString);
    selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    const invoiceDate = Timestamp.fromDate(selectedDate);

    const dateKey = toLocalDateString(selectedDate);

    const hhStr = String(now.getHours()).padStart(2, '0');
    const minStr = String(now.getMinutes()).padStart(2, '0');
    const secStr = String(now.getSeconds()).padStart(2, '0');
    const timeKey = `${hhStr}:${minStr}:${secStr}`;

    const docRef = providedDocRef || doc(collection(db, COLLECTION));
    const invoiceData = {
      ...rest,
      customerName: toTitleCase(rest.customerName),
      services: normalizedServices,
      products: normalizedProducts,
      ...(normalizedAppliedOffer ? { appliedOffer: normalizedAppliedOffer } : {}),
      date: dateTs,
      billDate: dateTs,
      invoiceDate,
      createdAt: serverTimestamp(),
      dateKey,
      timeKey,
    };

    if (providedBatch) {
      providedBatch.set(docRef, invoiceData);
      applyStatsAndInventoryDiff(providedBatch, null, invoiceData);
      return docRef.id;
    } else {
      const batch = writeBatch(db);
      batch.set(docRef, invoiceData);
      applyStatsAndInventoryDiff(batch, null, invoiceData);
      await batch.commit();
      return docRef.id;
    }
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
      const getTimestampMillis = (x: any) => {
        const ts = x.invoiceDate || x.createdAt || x.date;
        if (ts && typeof ts.toMillis === "function") return ts.toMillis();
        if (ts instanceof Date) return ts.getTime();
        if (typeof ts === "string") return new Date(ts).getTime();
        if (ts && typeof ts.seconds === "number") return ts.seconds * 1000;
        return 0;
      };
      return getTimestampMillis(b) - getTimestampMillis(a);
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
      const getTimestampMillis = (x: any) => {
        const ts = x.invoiceDate || x.createdAt || x.date;
        if (ts && typeof ts.toMillis === "function") return ts.toMillis();
        if (ts instanceof Date) return ts.getTime();
        if (typeof ts === "string") return new Date(ts).getTime();
        if (ts && typeof ts.seconds === "number") return ts.seconds * 1000;
        return 0;
      };
      return getTimestampMillis(b) - getTimestampMillis(a);
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

    if (normalizedData.invoiceDate) {
      normalizedData.dateKey = toLocalDateString(normalizedData.invoiceDate);
      const dateObj = typeof normalizedData.invoiceDate.toDate === "function" 
        ? normalizedData.invoiceDate.toDate() 
        : new Date(normalizedData.invoiceDate);
      dateObj.setHours(0, 0, 0, 0);
      normalizedData.billDate = Timestamp.fromDate(dateObj);
      normalizedData.date = normalizedData.billDate;
    }

    await runTransaction(db, async (tx) => {
      const docRef = doc(db, COLLECTION, id);
      const oldSnap = await tx.get(docRef);
      if (!oldSnap.exists()) {
        throw new Error("Invoice does not exist");
      }
      const oldInv = { id, ...oldSnap.data() } as Invoice;
      const newInv = { ...oldInv, ...normalizedData } as Invoice;

      applyStatsAndInventoryDiff(tx, oldInv, newInv);
      tx.update(docRef, normalizedData);
    });
  } catch (error) {
    console.error(`Error updating invoice ${id}:`, error);
    throw error;
  }
}

export async function getByCustomerId(customerId: string): Promise<Invoice[]> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where("customerId", "==", customerId)
    );
    const snap = await getDocs(q);
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invoice));
    return docs.sort((a, b) => {
      const getTimestampMillis = (x: any) => {
        const ts = x.invoiceDate || x.createdAt || x.date;
        if (ts && typeof ts.toMillis === "function") return ts.toMillis();
        if (ts instanceof Date) return ts.getTime();
        if (typeof ts === "string") return new Date(ts).getTime();
        if (ts && typeof ts.seconds === "number") return ts.seconds * 1000;
        return 0;
      };
      return getTimestampMillis(b) - getTimestampMillis(a);
    });
  } catch (error) {
    console.error(`Error fetching invoices for customer ${customerId}:`, error);
    throw error;
  }
}

export async function createMembershipInvoice(params: {
  customerId: string;
  customerName: string;
  customerPhone: string;
  membershipAmount: number;
  paymentMethod: "Cash" | "UPI" | "Card";
  dateString?: string;
}): Promise<string> {
  const dateStr = params.dateString || toLocalDateString(new Date());
  const invoiceNumber = await getNextInvoiceNumber(dateStr);

  const cashVal = params.paymentMethod === "Cash" ? params.membershipAmount : 0;
  const upiVal = params.paymentMethod === "UPI" ? params.membershipAmount : 0;
  const cardVal = params.paymentMethod === "Card" ? params.membershipAmount : 0;

  const services = [
    {
      serviceId: "membership_fee",
      serviceName: "Membership Fee",
      staffId: "system",
      staffName: "System",
      price: params.membershipAmount,
      discount: 0,
      amount: params.membershipAmount,
      usedProductId: null,
      usedProductName: null,
      usedProductCost: 0,
    },
  ];

  return create({
    invoiceNumber,
    dateString: dateStr,
    customerId: params.customerId,
    customerName: params.customerName,
    customerPhone: params.customerPhone,
    customerType: "membership",
    services: services as any,
    products: [],
    totalServices: params.membershipAmount,
    totalProducts: 0,
    subtotal: params.membershipAmount,
    totalDiscount: 0,
    grandTotal: params.membershipAmount,
    paymentSplit: {
      cash: cashVal,
      upi: upiVal,
      card: cardVal,
    },
    paymentStatus: "paid",
  });
}

export async function getByDateKey(dateKey: string): Promise<Invoice[]> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where("dateKey", "==", dateKey)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invoice));
  } catch (error) {
    console.error(`Error fetching invoices for date key ${dateKey}:`, error);
    throw error;
  }
}

async function deleteInvoice(id: string): Promise<void> {
  try {
    await runTransaction(db, async (tx) => {
      const docRef = doc(db, COLLECTION, id);
      const oldSnap = await tx.get(docRef);
      if (!oldSnap.exists()) return;
      const oldInv = { id, ...oldSnap.data() } as Invoice;

      applyStatsAndInventoryDiff(tx, oldInv, null);
      tx.delete(docRef);
    });
  } catch (error) {
    console.error(`Error deleting invoice ${id}:`, error);
    throw error;
  }
}

export async function collectCreditPayment(
  originalInvoiceId: string,
  collectedAmount: number,
  paymentSplit: { cash: number; upi: number; card: number },
  collectionDate?: Date | string,
  note?: string
): Promise<void> {
  if (collectedAmount <= 0) {
    throw new Error(`Invalid payment amount: ₹${collectedAmount}. Must be greater than 0.`);
  }

  try {
    // 1. Fetch pending credit balance documents for this invoice
    // Check both originalInvoiceId and legacy invoiceId fields
    const [q1Snap, q2Snap] = await Promise.all([
      getDocs(query(
        collection(db, "credit_balances"),
        where("originalInvoiceId", "==", originalInvoiceId),
        where("status", "==", "pending")
      )),
      getDocs(query(
        collection(db, "credit_balances"),
        where("invoiceId", "==", originalInvoiceId),
        where("status", "==", "pending")
      )),
    ]);

    const creditDocIdSet = new Set<string>();
    const creditDocIds: string[] = [];
    [...q1Snap.docs, ...q2Snap.docs].forEach((d) => {
      if (!creditDocIdSet.has(d.id)) {
        creditDocIdSet.add(d.id);
        creditDocIds.push(d.id);
      }
    });

    // 2. Perform the update in an atomic Firestore Transaction
    await runTransaction(db, async (tx) => {
      // 2a. Get original invoice inside transaction (reads first)
      const invoiceRef = doc(db, COLLECTION, originalInvoiceId);
      const invoiceSnap = await tx.get(invoiceRef);
      if (!invoiceSnap.exists()) {
        throw new Error(`Original invoice ${originalInvoiceId} not found`);
      }
      const oldInv = { id: originalInvoiceId, ...invoiceSnap.data() } as Invoice;

      // 2b. Read all credit balance docs inside transaction
      let creditSnaps: Array<{ ref: any; data: any; id: string }> = [];
      for (const creditDocId of creditDocIds) {
        const creditRef = doc(db, "credit_balances", creditDocId);
        const creditSnap = await tx.get(creditRef);
        if (creditSnap.exists()) {
          creditSnaps.push({ ref: creditRef, data: creditSnap.data(), id: creditDocId });
        }
      }

      // Legacy fallback: also check by invoiceNumber if no docs matched by ID
      if (creditSnaps.length === 0 && oldInv.invoiceNumber) {
        const numSnap = await getDocs(query(
          collection(db, "credit_balances"),
          where("originalInvoiceNumber", "==", oldInv.invoiceNumber),
          where("status", "==", "pending")
        ));
        for (const docSnap of numSnap.docs) {
          if (!creditDocIdSet.has(docSnap.id)) {
            const creditRef = doc(db, "credit_balances", docSnap.id);
            const snap = await tx.get(creditRef);
            if (snap.exists()) {
              creditSnaps.push({ ref: creditRef, data: snap.data(), id: docSnap.id });
            }
          }
        }
      }

      // 2c. Delegate to pure allocation logic (validates bounds and sorts oldest first)
      const ledgerInput = creditSnaps.map((c) => ({
        id: c.id,
        ...c.data,
      }));

      const allocation = allocateCreditPayment(ledgerInput, collectedAmount, oldInv);

      const now = collectionDate ? new Date(collectionDate) : new Date();
      const nowIso = now.toISOString();
      const currentDateKey = toLocalDateString(now);
      const currentMonthKey = currentDateKey.substring(0, 7);

      // Determine payment method label
      const methodLabel = paymentSplit.card > 0 && paymentSplit.cash === 0 && paymentSplit.upi === 0
        ? "Card"
        : paymentSplit.upi > 0 && paymentSplit.cash === 0 && paymentSplit.card === 0
          ? "UPI"
          : paymentSplit.cash > 0 && paymentSplit.upi === 0 && paymentSplit.card === 0
            ? "Cash"
            : "Split";

      // 2d. Apply atomic writes to all allocated ledger documents
      const snapMap = new Map(creditSnaps.map((c) => [c.id, c.ref]));
      for (const alloc of allocation.allocations) {
        const ref = snapMap.get(alloc.docId);
        if (!ref) continue;

        tx.update(ref, {
          remainingAmount: alloc.newRemaining,
          status: alloc.status,
          collectionStatus: alloc.collectionStatus,
          collectedAmount: alloc.newCollected,
          settledAt: alloc.isFullySettled ? nowIso : null,
          lastCollectionDate: nowIso,
          lastCollectionMethod: methodLabel,
          updatedAt: nowIso,
        });
      }

      // 2e. Update invoice document
      const currentSplit = oldInv.paymentSplit || { cash: 0, upi: 0, card: 0 };
      const updatedSplit = {
        cash: (currentSplit.cash || 0) + (paymentSplit.cash || 0),
        upi: (currentSplit.upi || 0) + (paymentSplit.upi || 0),
        card: (currentSplit.card || 0) + (paymentSplit.card || 0),
      };

      const paymentRecord = {
        collectedAt: nowIso,
        collectedAmount,
        paymentSplit: {
          cash: paymentSplit.cash || 0,
          upi: paymentSplit.upi || 0,
          card: paymentSplit.card || 0,
        },
        remainingBalance: allocation.invoiceNextBalance,
        ...(note ? { note: note.trim() } : {}),
      };

      const existingHistory = (oldInv as any).creditPaymentHistory || [];
      const updatedHistory = [...existingHistory, paymentRecord];

      tx.update(invoiceRef, {
        receivedAmount: allocation.invoiceNextReceived,
        balanceDue: allocation.invoiceNextBalance,
        paymentStatus: allocation.invoiceNextStatus,
        paymentSplit: updatedSplit,
        creditPaymentHistory: updatedHistory,
        updatedAt: serverTimestamp(),
      });

      // 2f. Attribute collection to current period statistics
      const dailyRef = doc(db, "stats", `daily_${currentDateKey}`);
      tx.set(dailyRef, {
        dateKey: currentDateKey,
        totalRevenue: increment(collectedAmount),
        cash: increment(paymentSplit.cash || 0),
        upi: increment(paymentSplit.upi || 0),
        card: increment(paymentSplit.card || 0),
        ownerShare: increment(collectedAmount), // Old credit collections belong 100% to owner
        creditCollectionsRevenue: increment(collectedAmount),
      }, { merge: true });

      const monthlyRef = doc(db, "stats", `revenue_${currentMonthKey}`);
      tx.set(monthlyRef, {
        totalRevenue: increment(collectedAmount),
        cash: increment(paymentSplit.cash || 0),
        upi: increment(paymentSplit.upi || 0),
        card: increment(paymentSplit.card || 0),
        creditCollectionsRevenue: increment(collectedAmount),
      }, { merge: true });
    });
  } catch (error) {
    console.error("Error in collectCreditPayment transaction:", error);
    throw error;
  }
}

export { deleteInvoice as delete };
import type { CreditBalance } from "@/types/creditBalance";
import type { Invoice } from "@/types/invoice";

export interface UnifiedCreditItem {
  id: string; // unique stable key for UI lists (invoiceId or invoiceNumber)
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  customerId?: string;
  date: string; // Formatted or ISO date
  rawDate: string;
  total: number;
  paid: number;
  due: number;
  collectionStatus: "unpaid" | "partial" | "settled";
  creditDocIds: string[]; // All underlying credit_balances document IDs
  ledgerRecords: CreditBalance[];
  isUnlinkedInvoice?: boolean; // True if the invoice has an unpaid shortfall but no credit_balances record
}

export interface UnifiedCreditSummary {
  items: UnifiedCreditItem[];
  totalDue: number;
  totalCredit: number;
  totalPaid: number;
  totalInvoicesCount: number;
}

/**
 * Calculates remaining balance due on an invoice using the top-level
 * balanceDue field if present, or falling back to (grandTotal - received).
 */
export function getInvoiceRemainingBalance(inv: any): number {
  if (!inv) return 0;
  if (inv.balanceDue !== undefined && inv.balanceDue !== null) {
    return Math.max(0, Number(inv.balanceDue) || 0);
  }
  const grandTotal = Number(inv.grandTotal) || 0;

  if (inv.receivedAmount !== undefined && inv.receivedAmount !== null) {
    return Math.max(0, grandTotal - Number(inv.receivedAmount));
  }

  const split = inv.paymentSplit || inv.payments;
  if (split) {
    const cash = Number(split.cash) || 0;
    const upi = Number(split.upi) || 0;
    const card = Number(split.card) || 0;
    const adv = Number(inv.advanceUsed) || 0;
    return Math.max(0, grandTotal - (cash + upi + card + adv));
  }

  if (inv.paymentStatus === "unpaid" || inv.paymentMethod === "Credit") {
    return grandTotal;
  }
  if (inv.paymentStatus === "paid") {
    return 0;
  }

  return 0;
}

/**
 * Builds a reconciled, unified read-model of outstanding credits by:
 * 1. Grouping multiple line-item credit_balances documents under their parent invoice.
 * 2. Normalizing invoice IDs and invoice numbers using authoritative invoice records.
 * 3. Reconciling invoice grandTotal, received payments, and remaining balances consistently.
 * 4. Filtering out fully settled records.
 * 5. Including unlinked unpaid invoices that have no credit_balances document.
 */
export function buildUnifiedCreditTracker(
  creditBalances: CreditBalance[],
  invoices: Invoice[] = []
): UnifiedCreditSummary {
  const invoiceMap = new Map<string, Invoice>();
  const invoiceNumMap = new Map<string, Invoice>();

  invoices.forEach((inv) => {
    if (inv.id) invoiceMap.set(inv.id, inv);
    if (inv.invoiceNumber) invoiceNumMap.set(inv.invoiceNumber, inv);
    if ((inv as any).invoiceNo) invoiceNumMap.set((inv as any).invoiceNo, inv);
  });

  // Invoices that have ANY credit ledger doc (settled or pending) are never "unlinked"
  const ledgerInvoiceIds = new Set<string>();
  const ledgerInvoiceNums = new Set<string>();
  creditBalances.forEach((c) => {
    const id = c.originalInvoiceId || c.invoiceId;
    const num = c.originalInvoiceNumber || c.invoiceNumber;
    if (id) ledgerInvoiceIds.add(id);
    if (num) ledgerInvoiceNums.add(num);
  });

  // Group credit balances by parent invoice
  const groups = new Map<string, {
    key: string;
    invoiceId: string;
    invoiceNumber: string;
    customerId: string;
    customerName: string;
    customerPhone: string;
    date: string;
    rawDate: string;
    creditDocIds: string[];
    ledgerRecords: CreditBalance[];
    totalCredit: number;
    totalRemaining: number;
  }>();

  creditBalances.forEach((c) => {
    // Only pending records with remaining debt
    const remaining = Number(c.remainingAmount !== undefined ? c.remainingAmount : (c.amount ?? 0));
    if (remaining <= 0) return;
    const statusLower = String(c.status || "").toLowerCase();
    const collectionStatusLower = String(c.collectionStatus || "").toLowerCase();
    if (statusLower === "settled" || statusLower === "paid" || statusLower === "completed" || statusLower === "void" || statusLower === "cancelled") return;
    if (collectionStatusLower === "settled" || collectionStatusLower === "paid" || collectionStatusLower === "completed" || collectionStatusLower === "void" || collectionStatusLower === "cancelled") return;

    let invId = c.originalInvoiceId || c.invoiceId || "";
    let invNum = c.originalInvoiceNumber || c.invoiceNumber || "";

    // Normalize IDs and numbers using authoritative invoice map
    if (invId && invoiceMap.has(invId)) {
      const inv = invoiceMap.get(invId)!;
      if (!invNum && (inv.invoiceNumber || (inv as any).invoiceNo)) {
        invNum = inv.invoiceNumber || (inv as any).invoiceNo;
      }
    }
    if (invNum && invoiceNumMap.has(invNum)) {
      const inv = invoiceNumMap.get(invNum)!;
      if (!invId && inv.id) {
        invId = inv.id;
      }
    }

    // Stable groupKey: prioritize stable invoice ID, then invoice number, then credit document ID
    const groupKey = invId ? `inv_${invId}` : (invNum ? `num_${invNum}` : `doc_${c.id || "unknown"}`);

    const creditAmt = Number(c.creditAmount !== undefined ? c.creditAmount : (c.amount ?? remaining));
    const billDate = c.originalBillDate || c.createdAt || "";

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        key: groupKey,
        invoiceId: invId,
        invoiceNumber: invNum,
        customerId: c.customerId || "",
        customerName: c.customerName || "Customer",
        customerPhone: c.customerPhone || "",
        date: billDate,
        rawDate: billDate,
        creditDocIds: c.id ? [c.id] : [],
        ledgerRecords: [c],
        totalCredit: creditAmt,
        totalRemaining: remaining,
      });
    } else {
      const g = groups.get(groupKey)!;
      if (c.id && !g.creditDocIds.includes(c.id)) g.creditDocIds.push(c.id);
      g.ledgerRecords.push(c);
      g.totalCredit += creditAmt;
      g.totalRemaining += remaining;
      // Prefer earlier originalBillDate if available
      if (billDate && (!g.date || billDate < g.date)) {
        g.date = billDate;
        g.rawDate = billDate;
      }
      if (!g.invoiceId && invId) g.invoiceId = invId;
      if (!g.invoiceNumber && invNum) g.invoiceNumber = invNum;
    }
  });

  const matchedInvoiceIds = new Set<string>();
  const matchedInvoiceNums = new Set<string>();
  const items: UnifiedCreditItem[] = [];

  // Transform credit groups into unified items
  groups.forEach((g) => {
    // Cross-reference with authoritative invoice record if available
    let matchedInv: Invoice | undefined;
    if (g.invoiceId && invoiceMap.has(g.invoiceId)) {
      matchedInv = invoiceMap.get(g.invoiceId);
    } else if (g.invoiceNumber && invoiceNumMap.has(g.invoiceNumber)) {
      matchedInv = invoiceNumMap.get(g.invoiceNumber);
    }

    if (matchedInv) {
      if (matchedInv.id) matchedInvoiceIds.add(matchedInv.id);
      if (matchedInv.invoiceNumber) matchedInvoiceNums.add(matchedInv.invoiceNumber);
      if ((matchedInv as any).invoiceNo) matchedInvoiceNums.add((matchedInv as any).invoiceNo);
    }

    // 1. Authoritative Invoice Total
    const total = matchedInv ? (Number(matchedInv.grandTotal) || g.totalCredit) : g.totalCredit;

    // 2. Authoritative Outstanding Due
    let due = g.totalRemaining;
    if (matchedInv) {
      const invStatusLower = String((matchedInv as any).status || "").toLowerCase();
      const invPayStatusLower = String(matchedInv.paymentStatus || "").toLowerCase();
      if (invStatusLower === "void" || invStatusLower === "cancelled") {
        due = 0;
      } else if (invPayStatusLower === "paid") {
        due = 0;
      } else {
        const invBalance = getInvoiceRemainingBalance(matchedInv);
        if (invBalance <= 0) {
          due = 0;
        } else if (g.totalRemaining > 0) {
          // Reconcile to smaller balance if both are positive (handles partial collections)
          due = Math.min(invBalance, g.totalRemaining);
        } else {
          due = invBalance;
        }
      }
    }

    // Strictly exclude fully settled records with zero remaining balance
    if (due <= 0) return;

    // 3. Authoritative Paid: Total - Due (guarantees Paid + Due === Total without double-counting)
    const paid = Math.max(0, total - due);
    const collectionStatus = paid > 0 ? "partial" : "unpaid";

    items.push({
      id: g.invoiceId || g.key,
      invoiceId: g.invoiceId || (matchedInv?.id ?? ""),
      invoiceNumber: g.invoiceNumber || (matchedInv?.invoiceNumber ?? "—"),
      customerName: matchedInv?.customerName || g.customerName,
      customerPhone: matchedInv?.customerPhone || g.customerPhone,
      customerId: g.customerId,
      date: g.date,
      rawDate: g.rawDate,
      total,
      paid,
      due,
      collectionStatus,
      creditDocIds: g.creditDocIds,
      ledgerRecords: g.ledgerRecords,
      isUnlinkedInvoice: false,
    });
  });

  // Check for unlinked unpaid invoices (invoices with positive balanceDue not in credit_balances)
  invoices.forEach((inv) => {
    if (!inv.id) return;
    if (ledgerInvoiceIds.has(inv.id)) return;
    if (inv.invoiceNumber && ledgerInvoiceNums.has(inv.invoiceNumber)) return;
    if ((inv as any).invoiceNo && ledgerInvoiceNums.has((inv as any).invoiceNo)) return;
    if (matchedInvoiceIds.has(inv.id)) return;
    if (inv.invoiceNumber && matchedInvoiceNums.has(inv.invoiceNumber)) return;
    if ((inv as any).invoiceNo && matchedInvoiceNums.has((inv as any).invoiceNo)) return;
    const invPayStatusLower = String(inv.paymentStatus || "").toLowerCase();
    const invStatusLower = String((inv as any).status || "").toLowerCase();
    if (invPayStatusLower === "paid") return;
    if (invStatusLower === "void" || invStatusLower === "cancelled") return;

    const remainingDue = getInvoiceRemainingBalance(inv);
    if (remainingDue <= 0) return;

    const grandTotal = Number(inv.grandTotal) || remainingDue;
    const paid = Math.max(0, grandTotal - remainingDue);
    const dateStr = inv.dateKey || (inv.date && typeof (inv.date as any).toDate === "function" ? (inv.date as any).toDate().toISOString() : "");

    items.push({
      id: inv.id,
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber || (inv as any).invoiceNo || "—",
      customerName: inv.customerName || "Customer",
      customerPhone: inv.customerPhone || "",
      customerId: inv.customerId,
      date: dateStr,
      rawDate: dateStr,
      total: grandTotal,
      paid,
      due: remainingDue,
      collectionStatus: paid > 0 ? "partial" : "unpaid",
      creditDocIds: [],
      ledgerRecords: [],
      isUnlinkedInvoice: true,
    });
  });

  // Sort by date descending (newest first)
  items.sort((a, b) => {
    const timeA = a.rawDate ? new Date(a.rawDate).getTime() : 0;
    const timeB = b.rawDate ? new Date(b.rawDate).getTime() : 0;
    return timeB - timeA;
  });

  const totalDue = items.reduce((sum, item) => sum + item.due, 0);
  const totalCredit = items.reduce((sum, item) => sum + item.total, 0);
  const totalPaid = items.reduce((sum, item) => sum + item.paid, 0);

  return {
    items,
    totalDue: Math.round(totalDue * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    totalInvoicesCount: items.length,
  };
}

/**
 * Loads all pending credit balances and all invoices from Firestore and builds
 * the authoritative unified credit tracker read-model.
 * Shared across credit-tracker.tsx, payments/page.tsx, and audit tools.
 */
export async function loadAuthoritativeUnifiedCreditTracker(
  firestoreDb?: any
): Promise<UnifiedCreditSummary> {
  const { db } = await import("@/lib/firebase");
  const activeDb = firestoreDb || db;
  const { collection, getDocs, query, where } = await import("firebase/firestore");

  const [creditSnap, invoiceSnap] = await Promise.all([
    getDocs(collection(activeDb, "credit_balances")),
    getDocs(collection(activeDb, "invoices")),
  ]);

  const creditList: CreditBalance[] = [];
  creditSnap.forEach((doc) => {
    creditList.push({ id: doc.id, ...doc.data() } as CreditBalance);
  });

  const invoiceList: Invoice[] = [];
  invoiceSnap.forEach((doc) => {
    invoiceList.push({ id: doc.id, ...doc.data() } as Invoice);
  });

  return buildUnifiedCreditTracker(creditList, invoiceList);
}

export interface LedgerAllocationResult {
  docId: string;
  allocatedAmount: number;
  previousRemaining: number;
  newRemaining: number;
  previousCollected: number;
  newCollected: number;
  isFullySettled: boolean;
  status: "pending" | "settled";
  collectionStatus: "partial" | "settled";
}

export interface AllocationSummary {
  totalAllocated: number;
  invoiceNextReceived: number;
  invoiceNextBalance: number;
  invoiceNextStatus: "partial" | "paid";
  allocations: LedgerAllocationResult[];
}

/**
 * Pure allocation function that distributes a collection payment across
 * credit ledger documents (oldest first) and computes updated invoice fields.
 */
export function allocateCreditPayment(
  ledgerDocs: Array<{
    id?: string;
    remainingAmount?: number;
    amount?: number;
    collectedAmount?: number;
    createdAt?: string;
    status?: string;
    collectionStatus?: string;
  }>,
  amountToCollect: number,
  invoice: {
    grandTotal?: number;
    receivedAmount?: number;
    balanceDue?: number;
    paymentSplit?: { cash?: number; upi?: number; card?: number };
    advanceUsed?: number;
  }
): AllocationSummary {
  if (amountToCollect <= 0) {
    throw new Error(`Payment amount must be greater than 0 (received ₹${amountToCollect})`);
  }

  // Calculate total remaining balance across active ledger docs
  const activeDocs = ledgerDocs.filter((d) => {
    const rem = Number(d.remainingAmount !== undefined ? d.remainingAmount : (d.amount ?? 0));
    const statusLower = String(d.status || "").toLowerCase();
    const colStatusLower = String(d.collectionStatus || "").toLowerCase();
    return rem > 0 && statusLower !== "settled" && colStatusLower !== "settled";
  });

  const totalRemainingAcrossLedgers = activeDocs.reduce((sum, d) => {
    return sum + Number(d.remainingAmount !== undefined ? d.remainingAmount : (d.amount ?? 0));
  }, 0);

  if (amountToCollect > totalRemainingAcrossLedgers) {
    throw new Error(
      `Payment amount ₹${amountToCollect} exceeds total remaining credit debt of ₹${totalRemainingAcrossLedgers}`
    );
  }

  // Sort active docs oldest createdAt first
  const sortedDocs = [...activeDocs].sort((a, b) => {
    const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tA - tB;
  });

  let remainingToDistribute = amountToCollect;
  const allocations: LedgerAllocationResult[] = [];

  for (const doc of sortedDocs) {
    if (remainingToDistribute <= 0) break;

    const currentRem = Number(doc.remainingAmount !== undefined ? doc.remainingAmount : (doc.amount ?? 0));
    const prevCollected = Number(doc.collectedAmount ?? 0);
    const allocated = Math.min(remainingToDistribute, currentRem);
    const newRem = Math.max(0, currentRem - allocated);
    remainingToDistribute -= allocated;

    const isFullySettled = newRem <= 0;
    allocations.push({
      docId: doc.id || "",
      allocatedAmount: allocated,
      previousRemaining: currentRem,
      newRemaining: newRem,
      previousCollected: prevCollected,
      newCollected: prevCollected + allocated,
      isFullySettled,
      status: isFullySettled ? "settled" : "pending",
      collectionStatus: isFullySettled ? "settled" : "partial",
    });
  }

  // Calculate invoice level updates safely
  const currentReceived = invoice.receivedAmount !== undefined && invoice.receivedAmount !== null
    ? Number(invoice.receivedAmount)
    : ((invoice.paymentSplit?.cash || 0) + (invoice.paymentSplit?.upi || 0) + (invoice.paymentSplit?.card || 0) + (invoice.advanceUsed || 0));

  const currentBalance = invoice.balanceDue !== undefined && invoice.balanceDue !== null
    ? Number(invoice.balanceDue)
    : Math.max(0, (invoice.grandTotal || 0) - currentReceived);

  const invoiceNextReceived = currentReceived + amountToCollect;
  const invoiceNextBalance = Math.max(0, currentBalance - amountToCollect);
  const invoiceNextStatus: "partial" | "paid" = invoiceNextBalance <= 0 ? "paid" : "partial";

  return {
    totalAllocated: amountToCollect,
    invoiceNextReceived,
    invoiceNextBalance,
    invoiceNextStatus,
    allocations,
  };
}



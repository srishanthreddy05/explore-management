/**
 * Centralized business logic calculations for Salon ERP splits, revenues, and commissions.
 * This utility acts as the single source of truth across the billing, settlements, and backfill layers.
 */

export interface InvoicePayments {
  cash: number;
  upi: number;
  card: number;
}

export interface ServiceCommission {
  serviceRevenue: number;
  productCost: number;
  stylistShare: number;
  ownerShare: number;
}

/**
 * Extracts individual cash, upi, and card split payments from an invoice document.
 */
export function getInvoicePayments(inv: any): InvoicePayments {
  if (!inv) return { cash: 0, upi: 0, card: 0 };
  return {
    cash:
      inv.paymentSplit?.cash ??
      inv.payments?.cash ??
      (inv.paymentMethod === "Cash" ? inv.grandTotal || 0 : 0),
    upi:
      inv.paymentSplit?.upi ??
      inv.payments?.upi ??
      (inv.paymentMethod === "UPI" ? inv.grandTotal || 0 : 0),
    card:
      inv.paymentSplit?.card ??
      inv.payments?.card ??
      (inv.paymentMethod === "Card" ? inv.grandTotal || 0 : 0),
  };
}

/**
 * Calculates the payment ratio (collected / grandTotal) of an invoice.
 * Returns a value between 0.0 and 1.0. If grandTotal is 0 or negative, returns 1.0.
 */
export function getInvoicePaymentRatio(inv: any): number {
  if (!inv) return 1;
  const grandTotal = inv.grandTotal || 0;
  if (grandTotal <= 0) return 1;
  const payments = getInvoicePayments(inv);
  const collected = (payments.cash || 0) + (payments.upi || 0) + (payments.card || 0) + (inv.advanceUsed || 0);
  return Math.min(1, Math.max(0, collected / grandTotal));
}

/**
 * Calculates recognized retail products revenue for a single invoice document.
 * Adheres strictly to post-discount line amount or discountFactor fallback scaled by payment ratio.
 * Acts as the authoritative shared calculation across Reports and Settlements.
 */
export function calculateInvoiceRetailRevenue(inv: any): number {
  if (!inv || !inv.products || !Array.isArray(inv.products) || inv.products.length === 0) return 0;
  const ratio = getInvoicePaymentRatio(inv);
  const discountFactor = inv.subtotal > 0 ? (inv.grandTotal / inv.subtotal) : 1;
  let total = 0;
  inv.products.forEach((p: any) => {
    let amount: number;
    if (p.amount !== undefined && p.amount !== null) {
      amount = Number(p.amount);
    } else {
      const productBaseAmount = Math.max(
        (Number(p.price) || 0) * (Number(p.quantity) || 1) - (Number(p.discount) || 0),
        0
      );
      amount = productBaseAmount * discountFactor;
    }
    total += amount * ratio;
  });
  return total;
}

/**
 * Calculates stylist and owner splits for a single service transaction item.
 *
 * IMPORTANT: s.amount is the authoritative post-discount amount written by
 * BillingTerminal at billing time. It already reflects every per-service
 * line discount and the proportional bill-level discount. Do NOT apply
 * discountFactor on top of it — that would double-count those discounts.
 *
 * The discountFactor path is a fallback only for legacy invoice records
 * that pre-date the s.amount field (i.e., s.amount is absent/null).
 */
export function getServiceCommission(s: any, inv: any): ServiceCommission {
  if (!s) return { serviceRevenue: 0, productCost: 0, stylistShare: 0, ownerShare: 0 };

  // Use s.amount when present — it is already the correct post-discount value.
  // Fall back to price − discount × discountFactor for pre-s.amount legacy records.
  let amount: number;
  if (s.amount !== undefined && s.amount !== null) {
    amount = s.amount;
  } else {
    const serviceBaseAmount = Math.max((s.price || 0) - (s.discount || 0), 0);
    const discountFactor = inv && inv.subtotal > 0 ? (inv.grandTotal / inv.subtotal) : 1;
    amount = serviceBaseAmount * discountFactor;
  }

  const cost = s.usedProductCost || 0;

  let role = s.staffRole;
  if (!role) {
    if (s.serviceId === "membership_fee" || s.staffId === "system" || s.staffName === "System") {
      role = "Owner";
    } else {
      role = "Stylist";
    }
  }

  let stylistShare = 0;
  let ownerShare = 0;

  if (role === "Owner") {
    stylistShare = 0;
    ownerShare = amount;
  } else {
    // Business rule: Remove product cost first, then split remaining 50/50.
    const remainingService = amount - cost;
    stylistShare = remainingService * 0.5;
    ownerShare   = (remainingService * 0.5) + cost;
  }

  return {
    serviceRevenue: amount,
    productCost: cost,
    stylistShare,
    ownerShare,
  };
}

export interface StaffDetail {
  staffId: string;
  name: string;
  role: string;
  serviceRevenue: number;
  productCost: number;
  staffShare: number;
  ownerShareContribution: number;
  collectedCredits?: any[];
  collectedCreditsShare?: number;
}

export interface DaySettlementDetails {
  totalServiceRevenue: number;
  totalMembershipAmount: number;
  totalProductCost: number;
  totalStaffShare: number;
  totalOwnerShare: number;
  ownerDirectRevenue: number;
  staffRevenueContribution: number;
  staffProductReimbursement: number;
  retailProductsRevenue: number;
  staffDetails: Record<string, StaffDetail>;
  collectedCredits: any[];
}

export function calculateDaySettlement(
  dayInvoices: any[],
  staffList: any[],
  dateStr: string
): DaySettlementDetails {
  const result: DaySettlementDetails = {
    totalServiceRevenue: 0,
    totalMembershipAmount: 0,
    totalProductCost: 0,
    totalStaffShare: 0,
    totalOwnerShare: 0,
    ownerDirectRevenue: 0,
    staffRevenueContribution: 0,
    staffProductReimbursement: 0,
    retailProductsRevenue: 0,
    staffDetails: {},
    collectedCredits: [],
  };

  dayInvoices.forEach((inv) => {
    const ratio = getInvoicePaymentRatio(inv);

    const invCollectedCredits: any[] = inv.collectedCredits || [];
    invCollectedCredits.forEach((cc: any) => {
      const amount = cc.collectedAmount || 0;
      const method = cc.paymentSplit
        ? (cc.paymentSplit.cash > 0 && cc.paymentSplit.upi === 0 && cc.paymentSplit.card === 0 ? "CASH"
          : cc.paymentSplit.upi > 0 && cc.paymentSplit.cash === 0 && cc.paymentSplit.card === 0 ? "UPI"
          : cc.paymentSplit.card > 0 && cc.paymentSplit.cash === 0 && cc.paymentSplit.upi === 0 ? "CARD"
          : "SPLIT")
        : inv.paymentMethod || "UPI";

      result.collectedCredits.push({
        originalBillDate: cc.collectedAt || dateStr,
        originalInvoiceNumber: cc.originalInvoiceNumber || "",
        collectionDate: dateStr,
        collectionMethod: method,
        collectedBy: "System",
        amount,
        serviceOrProductName: `Credit Collected (Inv #${cc.originalInvoiceNumber || "?"})`,
        type: "credit",
        share: amount,
      });

      result.ownerDirectRevenue += amount;
      result.totalOwnerShare += amount;
    });

    const retailRev = calculateInvoiceRetailRevenue(inv);
    result.retailProductsRevenue += retailRev;
    result.totalOwnerShare += retailRev;

    (inv.services || []).forEach((s: any) => {
      const comm = getServiceCommission(s, inv);
      const staffId = s.staffId || "unassigned";
      const staffName = s.staffName || "Unassigned";

      const staffMember = staffList.find(
        (st) => st.id === staffId || st.name === staffName
      );
      const role = s.staffRole || staffMember?.role || "Stylist";

      if (s.serviceId === "membership_fee") {
        result.totalMembershipAmount += comm.serviceRevenue * ratio;
        result.totalOwnerShare += comm.serviceRevenue * ratio;
        return;
      }

      const key = staffId !== "unassigned" ? staffId : staffName;
      if (!result.staffDetails[key]) {
        result.staffDetails[key] = {
          staffId,
          name: staffName,
          role,
          serviceRevenue: 0,
          productCost: 0,
          staffShare: 0,
          ownerShareContribution: 0,
          collectedCredits: [],
          collectedCreditsShare: 0,
        };
      }
      const sd = result.staffDetails[key];

      result.totalServiceRevenue += comm.serviceRevenue * ratio;
      result.totalProductCost += comm.productCost * ratio;

      if (role === "Owner") {
        result.ownerDirectRevenue += comm.ownerShare * ratio;
        result.totalOwnerShare += comm.ownerShare * ratio;

        sd.serviceRevenue += comm.serviceRevenue * ratio;
        sd.productCost += comm.productCost * ratio;
        sd.ownerShareContribution += comm.ownerShare * ratio;
      } else {
        const remainingService = comm.serviceRevenue - comm.productCost;
        result.staffRevenueContribution += 0.5 * remainingService * ratio;
        result.staffProductReimbursement += comm.productCost * ratio;

        result.totalStaffShare += comm.stylistShare * ratio;
        result.totalOwnerShare += comm.ownerShare * ratio;

        sd.serviceRevenue += comm.serviceRevenue * ratio;
        sd.productCost += comm.productCost * ratio;
        sd.staffShare += comm.stylistShare * ratio;
        sd.ownerShareContribution += comm.ownerShare * ratio;
      }
    });
  });

  return result;
}

export interface SettlementRangeOverview {
  ownerShare: number;
  membershipAmount: number;
  retailProductsRevenue: number;
  serviceSuppliesUsed: number;
  totalServiceRevenue: number;
  totalStylistShare: number;
  creditCollectionsRevenue: number;
  staffSummaryMap: Record<string, { revenueGenerated: number; productCosts: number; netShare: number }>;
}

/**
 * Calculates authoritative financial breakdown for any date range from raw invoices.
 * Acts as the shared calculation engine between Settlements and Reports.
 */
export function calculateSettlementRangeOverview(
  invoices: any[],
  dateFrom: string,
  dateTo: string,
  staffList: any[] = []
): SettlementRangeOverview {
  let ownerShare = 0;
  let membershipAmount = 0;
  let retailProductsRevenue = 0;
  let serviceSuppliesUsed = 0;
  let totalServiceRevenue = 0;
  let totalStylistShare = 0;
  let creditCollectionsRevenue = 0;
  const staffSummaryMap: Record<string, { revenueGenerated: number; productCosts: number; netShare: number }> = {};

  const registeredCreditCollections = new Set<string>();

  invoices.forEach((inv) => {
    const dKey = inv.dateKey || (inv.dateString ? inv.dateString.slice(0, 10) : "");
    const isInDateRange = dKey >= dateFrom && dKey <= dateTo;

    // Check direct credit payment collections recorded on prior invoices
    const directPayments: any[] = inv.creditPaymentHistory || [];
    directPayments.forEach((dp: any) => {
      const payDate = (dp.collectedAt || "").slice(0, 10);
      if (payDate >= dateFrom && payDate <= dateTo) {
        const amt = Number(dp.collectedAmount) || 0;
        const dedupeKey = `${inv.id || inv.invoiceNumber}_${amt}`;
        if (amt > 0 && !registeredCreditCollections.has(dedupeKey)) {
          registeredCreditCollections.add(dedupeKey);
          creditCollectionsRevenue += amt;
          ownerShare += amt;
        }
      }
    });

    if (!isInDateRange) return;

    const ratio = getInvoicePaymentRatio(inv);

    // Collected credits on this invoice
    (inv.collectedCredits || []).forEach((cc: any) => {
      const amt = Number(cc.collectedAmount) || 0;
      const dedupeKey = `${cc.originalInvoiceId || cc.originalInvoiceNumber}_${amt}`;
      if (amt > 0 && !registeredCreditCollections.has(dedupeKey)) {
        registeredCreditCollections.add(dedupeKey);
        creditCollectionsRevenue += amt;
        ownerShare += amt;
      }
    });

    // Retail revenue
    const retailRev = calculateInvoiceRetailRevenue(inv);
    retailProductsRevenue += retailRev;
    ownerShare += retailRev;

    // Services
    (inv.services || []).forEach((s: any) => {
      const staffId = s.staffId || "unassigned";
      const staffName = s.staffName || "Unassigned";
      const staffMember = staffList.find((st) => st.id === staffId || st.name === staffName);
      const role = s.staffRole || staffMember?.role || (staffName === "System" ? "Owner" : "Stylist");

      const comm = getServiceCommission(s, inv);
      totalServiceRevenue += comm.serviceRevenue * ratio;
      ownerShare += comm.ownerShare * ratio;

      if (s.serviceId === "membership_fee") {
        membershipAmount += comm.serviceRevenue * ratio;
      }

      if (role !== "Owner" && staffId !== "system" && staffName !== "System") {
        serviceSuppliesUsed += comm.productCost * ratio;
        totalStylistShare += comm.stylistShare * ratio;
      }

      const key = staffId !== "unassigned" ? staffId : staffName;
      if (!staffSummaryMap[key]) {
        staffSummaryMap[key] = { revenueGenerated: 0, productCosts: 0, netShare: 0 };
      }
      staffSummaryMap[key].revenueGenerated += comm.serviceRevenue * ratio;
      staffSummaryMap[key].productCosts += comm.productCost * ratio;
      staffSummaryMap[key].netShare += comm.stylistShare * ratio;
    });
  });

  return {
    ownerShare,
    membershipAmount,
    retailProductsRevenue,
    serviceSuppliesUsed,
    totalServiceRevenue,
    totalStylistShare,
    creditCollectionsRevenue,
    staffSummaryMap,
  };
}


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
    // Business rule: 50/50 split on the service amount.
    // Product cost is transferred from stylist to owner (deducted from stylist,
    // added to owner) — but product cost must NOT affect the 50/50 base split.
    stylistShare = 0.5 * amount - cost;
    ownerShare   = 0.5 * amount + cost;
  }

  return {
    serviceRevenue: amount,
    productCost: cost,
    stylistShare,
    ownerShare,
  };
}

export interface Offer {
  id?: string;
  code: string;
  name: string;
  discountType: "percentage" | "flat" | string;
  discountValue: number;
  status: "Active" | "Inactive" | string;

  // ── Validity window ──────────────────────────────────────────────────────
  // Stored as "YYYY-MM-DD" strings to match the rest of the app's date handling
  // (e.g. billing page's dateString). An offer is valid when:
  //   startDate <= billDate <= endDate
  // If either is empty/undefined, that bound is treated as open-ended.
  startDate?: string;
  endDate?: string;

  // ── Applicability ────────────────────────────────────────────────────────
  // If both arrays are empty, the offer applies to the whole bill (subtotal).
  // If either has entries, the offer only discounts matching service/product
  // line items (by Firestore document ID).
  applicableServiceIds?: string[];
  applicableProductIds?: string[];

  // ── Minimum bill amount ──────────────────────────────────────────────────
  // Offer can only be applied if the bill subtotal (before this offer's
  // discount) is >= this amount. 0 or undefined means no minimum.
  minBillAmount?: number;

  createdAt?: string;
}
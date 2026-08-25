/**
 * Shared pure utility for cost-per-serving calculations.
 *
 * BUSINESS RULE:
 *   costPerServing = originalPurchaseCost / originalServings
 *
 * This value must NEVER be recalculated using remaining/depleted servings.
 * The original serving count is immutable once a product is created.
 */

export interface ServingCostProduct {
  amount?: number | null;         // original purchase cost (₹)
  originalServings?: number | null; // immutable original serving count
  noOfServings?: number | null;   // remaining servings (decremented on use)
  costPerServing?: number | null; // stored at creation: amount / originalServings
}

/**
 * Computes the original cost per serving.
 * Always uses originalPurchaseCost / originalServings.
 * Never uses remaining servings.
 */
export function computeCostPerServing(
  originalPurchaseCost: number,
  originalServings: number
): number {
  if (!originalServings || originalServings <= 0) return 0;
  if (!originalPurchaseCost || originalPurchaseCost <= 0) return 0;
  return originalPurchaseCost / originalServings;
}

/**
 * Returns the correct cost per serving from a product record.
 * Priority:
 *   1. Stored costPerServing (most authoritative if originalServings was used)
 *   2. Recompute from amount / originalServings
 *   3. 0 (fallback)
 *
 * This ensures billing always uses the correct, immutable cost per serving.
 */
export function getEffectiveCostPerServing(product: ServingCostProduct): number {
  // If a valid stored value exists, trust it (it was computed at creation using originalServings)
  if (typeof product.costPerServing === "number" && product.costPerServing > 0) {
    return product.costPerServing;
  }
  // Fallback: recompute from originalServings if available
  if (
    typeof product.amount === "number" &&
    typeof product.originalServings === "number" &&
    product.originalServings > 0
  ) {
    return computeCostPerServing(product.amount, product.originalServings);
  }
  return 0;
}

/**
 * Calculates the cost consumed for a given quantity of servings used.
 * productCostUsed = quantityUsed × originalCostPerServing
 */
export function computeConsumedCost(
  quantityUsed: number,
  originalCostPerServing: number
): number {
  return quantityUsed * originalCostPerServing;
}

/**
 * Calculates remaining inventory value.
 * remainingValue = remainingServings × originalCostPerServing
 */
export function computeRemainingInventoryValue(
  remainingServings: number,
  originalCostPerServing: number
): number {
  return Math.max(0, remainingServings) * originalCostPerServing;
}

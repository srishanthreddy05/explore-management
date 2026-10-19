/**
 * Shared pure utility for cost-per-serving calculations.
 *
 * BUSINESS RULES:
 *   1. Initial creation:
 *      costPerServing = originalPurchaseCost / originalPurchasedServings
 *   2. Servings consumed by services:
 *      remainingServings = remainingServings - 1
 *      originalPurchaseCost, originalPurchasedServings, and costPerServing MUST NOT CHANGE on consumption.
 *   3. Refilling stock:
 *      - Case A (same unit cost): unit cost remains unchanged.
 *      - Case B (different unit cost): weighted-average unit cost:
 *        newAverageCost = (oldRemainingServings * oldUnitCost + newServings * newUnitCost) / (oldRemainingServings + newServings)
 *      - Case C (depleted / 0 remaining): new unit cost = refillCost / newServings.
 *
 * This value must NEVER be recalculated using remaining/depleted servings alone.
 */

export interface ServingCostProduct {
  amount?: number | null;         // original purchase cost (₹)
  originalServings?: number | null; // immutable original serving count
  noOfServings?: number | null;   // remaining servings (decremented on use)
  costPerServing?: number | null; // current effective unit cost
}

export interface RefillCostResult {
  newRemainingServings: number;
  newCostPerServing: number;
  refillUnitCost: number;
  isSameUnitCost: boolean;
}

/**
 * Computes the original cost per serving from total purchase cost and original servings.
 * Always uses originalPurchaseCost / originalPurchasedServings.
 * Never uses remaining servings.
 */
export function computeCostPerServing(
  originalPurchaseCost: number,
  originalServings: number
): number {
  if (!originalServings || originalServings <= 0) return 0;
  if (!originalPurchaseCost || originalPurchaseCost <= 0) return 0;
  return Math.round((originalPurchaseCost / originalServings) * 100) / 100;
}

/**
 * Safely resolves the original purchased servings count for a product,
 * protecting against legacy data where originalServings was not stored or corrupted.
 */
export function resolveProductOriginalServings(product: ServingCostProduct): number {
  if (typeof product.originalServings === "number" && product.originalServings > 0) {
    return product.originalServings;
  }
  // If originalServings is missing, but amount and costPerServing exist:
  // We can recover originalServings = amount / costPerServing
  if (
    typeof product.amount === "number" &&
    product.amount > 0 &&
    typeof product.costPerServing === "number" &&
    product.costPerServing > 0
  ) {
    return Math.round(product.amount / product.costPerServing);
  }
  // Fallback to remaining servings if available
  if (typeof product.noOfServings === "number" && product.noOfServings > 0) {
    return product.noOfServings;
  }
  return 0;
}

/**
 * Returns the correct cost per serving from a product record.
 * Priority:
 *   1. Stored costPerServing (authoritative, set at creation or updated on refill)
 *   2. Recompute from amount / originalServings (if originalServings > 0)
 *   3. Recompute from amount / resolved originalServings
 *   4. 0 (fallback)
 *
 * This ensures billing and reporting always use the correct, immutable unit cost.
 */
export function getEffectiveCostPerServing(product: ServingCostProduct): number {
  if (typeof product.costPerServing === "number" && product.costPerServing > 0) {
    return product.costPerServing;
  }
  const original = resolveProductOriginalServings(product);
  if (typeof product.amount === "number" && product.amount > 0 && original > 0) {
    return computeCostPerServing(product.amount, original);
  }
  return 0;
}

/**
 * Validates inputs for a stock refill operation.
 * Additional servings must be a positive integer (> 0).
 * Refill cost must be a non-negative number (>= 0).
 */
export function validateRefillInput(
  additionalServings: unknown,
  refillCost: unknown
): { valid: boolean; error?: string } {
  const srv = Number(additionalServings);
  if (isNaN(srv) || !Number.isInteger(srv) || srv <= 0) {
    return {
      valid: false,
      error: "Additional servings must be a positive whole number greater than 0.",
    };
  }
  const cost = Number(refillCost);
  if (isNaN(cost) || cost < 0) {
    return {
      valid: false,
      error: "Refill purchase cost cannot be negative.",
    };
  }
  return { valid: true };
}

/**
 * Computes the new remaining servings and cost per serving for a stock refill.
 * Uses weighted-average costing when refilling at a different unit cost.
 *
 * Formula:
 *   newAverageCost = (oldRemainingServings * oldUnitCost + newServings * newUnitCost) / (oldRemainingServings + newServings)
 *
 * Case A (same unit cost):
 *   old: 4 servings @ ₹100 = ₹400
 *   new: 10 servings @ ₹100 = ₹1,000
 *   total: 14 servings, unit cost remains ₹100.
 *
 * Case B (different unit cost):
 *   old: 4 servings @ ₹100 = ₹400
 *   new: 10 servings @ ₹120 = ₹1,200
 *   total: 14 servings, unit cost = (400 + 1200) / 14 = ₹114.29.
 *
 * Depleted case (old remaining <= 0):
 *   new unit cost = newUnitCost = refillCost / additionalServings.
 */
export function computeRefillCostPerServing(
  currentRemainingServings: number,
  currentCostPerServing: number,
  additionalServings: number,
  refillCost: number
): RefillCostResult {
  const validation = validateRefillInput(additionalServings, refillCost);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const srv = Math.floor(Number(additionalServings));
  const cost = Number(refillCost);
  const refillUnitCost = Math.round((cost / srv) * 100) / 100;

  const oldRemaining = Math.max(0, currentRemainingServings || 0);
  const newRemainingServings = oldRemaining + srv;

  // Depleted stock case: previous stock is 0, so new stock takes new unit cost directly
  if (oldRemaining === 0) {
    return {
      newRemainingServings,
      newCostPerServing: refillUnitCost,
      refillUnitCost,
      isSameUnitCost: Math.abs(refillUnitCost - currentCostPerServing) < 0.001,
    };
  }

  // Case A: Same unit cost
  const isSame = Math.abs(refillUnitCost - currentCostPerServing) < 0.001;
  if (isSame) {
    return {
      newRemainingServings,
      newCostPerServing: currentCostPerServing,
      refillUnitCost,
      isSameUnitCost: true,
    };
  }

  // Case B: Different unit cost -> Weighted-average calculation
  const totalValue = (oldRemaining * currentCostPerServing) + (srv * refillUnitCost);
  const newCostPerServing = Math.round((totalValue / newRemainingServings) * 100) / 100;

  return {
    newRemainingServings,
    newCostPerServing,
    refillUnitCost,
    isSameUnitCost: false,
  };
}

/**
 * Calculates the cost consumed for a given quantity of servings used.
 * productCostUsed = quantityUsed × costPerServing
 */
export function computeConsumedCost(
  quantityUsed: number,
  costPerServing: number
): number {
  return quantityUsed * costPerServing;
}

/**
 * Calculates remaining inventory value.
 * remainingValue = remainingServings × costPerServing
 */
export function computeRemainingInventoryValue(
  remainingServings: number,
  costPerServing: number
): number {
  return Math.max(0, remainingServings) * costPerServing;
}


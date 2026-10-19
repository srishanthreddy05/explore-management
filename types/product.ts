export interface ProductRefill {
  id?: string;
  servingsAdded: number;
  cost: number;
  costPerServing: number; // cost / servingsAdded
  previousRemainingServings: number;
  newRemainingServings: number;
  previousCostPerServing: number;
  newCostPerServing: number;
  createdAt: string;
  notes?: string;
}

export interface Product {
  id?: string;
  name: string;
  price: number;
  quantity?: number | null; // Stock quantity (retail)
  createdAt?: string;
  type?: "retail" | "service";
  amount?: number | null; // Original purchase cost
  /**
   * IMMUTABLE: The original number of servings when the product was first purchased.
   * This field must NEVER be decremented on consumption.
   * Use noOfServings for the remaining/available count.
   */
  originalServings?: number | null;
  /**
   * Remaining servings available (decremented each time a serving is consumed).
   * Do NOT use this field as denominator to compute cost per serving.
   */
  noOfServings?: number | null;
  /**
   * Current unit cost per serving.
   * When created: amount / originalServings.
   * When refilled: updated via weighted average costing:
   * (remainingServings * oldCost + refillServings * refillCost) / (remainingServings + refillServings).
   * NEVER recomputed using consumed servings.
   */
  costPerServing?: number | null;
  /**
   * Total servings purchased cumulatively (original + all refills).
   */
  totalPurchasedServings?: number | null;
  /**
   * Total cost spent cumulatively across original purchase and all refills.
   */
  totalPurchaseCost?: number | null;
  /**
   * Timestamp/date of the last stock refill.
   */
  lastRefillAt?: any;
  /**
   * Historical log of refill batches.
   */
  refillHistory?: ProductRefill[];
  isActive?: boolean;
  brand?: string;
  category?: string;
}



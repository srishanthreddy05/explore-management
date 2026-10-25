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
  amount?: number | null; // Total purchase cost or recorded amount (service supplies)
  /**
   * LEGACY: The original number of servings from serving-based inventory.
   * Preserved for backward compatibility with historical records.
   */
  originalServings?: number | null;
  /**
   * LEGACY: Remaining servings available from serving-based inventory.
   * Preserved for backward compatibility with historical records.
   */
  noOfServings?: number | null;
  /**
   * LEGACY: Current unit cost per serving.
   * Preserved for backward compatibility with historical records.
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



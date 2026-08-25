export interface Product {
  id?: string;
  name: string;
  price: number;
  quantity?: number | null; // Stock quantity
  createdAt?: string;
  type?: "retail" | "service";
  amount?: number | null;
  /**
   * IMMUTABLE: The original number of servings when the product was purchased.
   * This field must NEVER be decremented — it is the denominator for costPerServing.
   * Use noOfServings for the remaining/available count.
   */
  originalServings?: number | null;
  /**
   * Remaining servings available (decremented each time a serving is consumed).
   * Do NOT use this field to compute cost per serving.
   */
  noOfServings?: number | null;
  /**
   * Cost per serving = amount / originalServings (computed once at creation, immutable).
   * NEVER recompute using noOfServings (remaining).
   */
  costPerServing?: number | null;
  isActive?: boolean;
  brand?: string;
  category?: string;
}


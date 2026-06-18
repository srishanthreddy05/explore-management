export interface Product {
  id?: string;
  name: string;
  price: number;
  quantity?: number | null; // Stock quantity
  createdAt?: string;
  type?: "retail" | "service";
  amount?: number | null;
  noOfServings?: number | null;
  costPerServing?: number | null;
  isActive?: boolean;
  brand?: string;
  category?: string;
}


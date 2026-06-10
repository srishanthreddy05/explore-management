export interface Offer {
  id?: string;
  code: string;
  name: string;
  discountType: "percentage" | "flat" | string;
  discountValue: number;
  status: "Active" | "Inactive" | string;
  createdAt?: string;
}

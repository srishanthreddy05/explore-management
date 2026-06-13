export type ServiceRow = {
  id: number;
  service: string;
  staff: string;
  price: number;
  quantity: number;
  discount: number;
};

export type ProductRow = {
  id: number;
  productId?: string;
  product: string;
  price: number;
  quantity: number;
  discount: number;
};

export type BillTotals = {
  serviceTotal: number;
  productTotal: number;
  subtotal: number;
  billDiscount: number;
  offerDiscount: number; // discount contributed by the selected offer
  gst: number;
  grandTotal: number;
};

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
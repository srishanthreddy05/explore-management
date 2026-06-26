export type ServiceRow = {
  id: number;
  service: string;
  staff: string;
  price: number;
  quantity: number;
  discount: number;
  usedProductId?: string;
  usedProductName?: string;
  usedProductCost?: number;
  isCreditSettle?: boolean;
};

export type ProductRow = {
  id: number;
  productId?: string;
  product: string;
  price: number;
  quantity: number;
  discount: number;
  isCreditSettle?: boolean;
};

export type BillTotals = {
  serviceTotal: number;
  productTotal: number;
  subtotal: number;
  billDiscount: number;
  lineDiscount?: number;
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
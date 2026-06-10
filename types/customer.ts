export interface Customer {
  id?: string;
  name: string;
  phone: string;
  customerType: "regular" | "membership";
  createdAt?: string;
}

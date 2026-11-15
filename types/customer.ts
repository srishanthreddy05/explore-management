export interface Customer {
  id?: string;
  name: string;
  phone: string;
  customerType: "regular" | "membership";
  createdAt?: string;
  rating?: number;
  membershipAmount?: number | null;
  membershipDuration?: number | null;
  membershipStart?: string | null;
  membershipEnd?: string | null;
}

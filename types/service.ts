export interface Service {
  id?: string;
  name: string;
  price: number;
  duration?: number; // in minutes
  category?: string;
  createdAt?: string;
}

export interface Appointment {
  id?: string;
  customerName: string;
  customerMobile: string;
  dateTime: string; // ISO date-time string
  services: string[]; // List of services requested
  staffName: string;
  status: "Scheduled" | "Completed" | "Cancelled" | string;
  notes?: string;
  createdAt?: string;
}

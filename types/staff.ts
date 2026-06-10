export interface Staff {
  id?: string;
  name: string;
  role: string;
  status: "Active" | "Inactive" | string;
  dutyStatus?: "onDuty" | "offDuty" | string;
  createdAt?: string;
}

export interface Notification {
  id?: string;
  title: string;
  message: string;
  type: "alert" | "info" | "success" | string;
  read: boolean;
  createdAt?: string;
}

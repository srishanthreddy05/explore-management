import { Timestamp } from "firebase/firestore";

export interface ServiceCategory {
  id?: string;
  name: string;
  createdAt: Timestamp | string;
}
